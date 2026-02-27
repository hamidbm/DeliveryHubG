import { NextResponse } from 'next/server';
import { getDb, fetchWorkItemById, emitEvent } from '../../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { ObjectId, Binary } from 'mongodb';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    if (!files || files.length === 0) return NextResponse.json({ error: 'No files provided' }, { status: 400 });

    const db = await getDb();
    await db.collection('workitems_attachments').createIndex({ workItemId: 1, createdAt: -1 });
    const now = new Date().toISOString();
    const uploadedBy = (payload as any)?.name || 'System';
    const itemId = ObjectId.isValid(id) ? new ObjectId(id) : id;

    const newAttachments = [];
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        return NextResponse.json({ error: `File too large: ${file.name}` }, { status: 413 });
      }
      const arrayBuffer = await file.arrayBuffer();
      const assetDoc = {
        workItemId: itemId,
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        data: new Binary(Buffer.from(arrayBuffer)),
        createdAt: now,
        uploadedBy
      };
      const result = await db.collection('workitems_attachments').insertOne(assetDoc);
      newAttachments.push({
        assetId: result.insertedId.toString(),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        url: `/api/work-items/attachments/${result.insertedId.toString()}`,
        uploadedBy,
        createdAt: now
      });
    }

    await db.collection('workitems').updateOne(
      { _id: itemId } as any,
      { $push: { attachments: { $each: newAttachments } }, $set: { updatedAt: now } } as any
    );

    try {
      const actor = {
        userId: String((payload as any)?.id || (payload as any)?.userId || (payload as any)?.email || uploadedBy),
        displayName: String((payload as any)?.name || (payload as any)?.displayName || uploadedBy),
        email: (payload as any)?.email ? String((payload as any).email) : undefined
      };
      for (const attachment of newAttachments) {
        await emitEvent({
          ts: now,
          type: 'workitems.item.attachmentuploaded',
          actor,
          resource: { type: 'workitems.item', id: String(itemId), title: item.title },
          context: { bundleId: item.bundleId, appId: item.applicationId },
          payload: { assetId: attachment.assetId, name: attachment.name, size: attachment.size, type: attachment.type }
        });
      }
    } catch {}

    return NextResponse.json({ success: true, attachments: newAttachments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
