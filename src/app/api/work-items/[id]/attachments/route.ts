import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../../shared/events/emitEvent';
import { fetchWorkItemById } from '../../../../../services/workItemsService';
import { ObjectId } from 'mongodb';
import { requireStandardUser } from '../../../../../shared/auth/guards';
import { createWorkItemAttachmentRecords } from '../../../../../server/db/repositories/workItemAttachmentsRepo';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    if (!files || files.length === 0) return NextResponse.json({ error: 'No files provided' }, { status: 400 });

    const uploadedBy = auth.principal.fullName || auth.principal.email || 'System';
    const filePayloads = [];
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        return NextResponse.json({ error: `File too large: ${file.name}` }, { status: 413 });
      }
      const arrayBuffer = await file.arrayBuffer();
      filePayloads.push({
        name: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        buffer: Buffer.from(arrayBuffer),
        uploadedBy
      });
    }

    const { attachments: newAttachments, now, itemRef } = await createWorkItemAttachmentRecords(id, filePayloads);

    try {
      const actor = {
        userId: auth.principal.userId,
        displayName: auth.principal.fullName || uploadedBy,
        email: auth.principal.email
      };
      for (const attachment of newAttachments) {
        await emitEvent({
          ts: now,
          type: 'workitems.item.attachmentuploaded',
          actor,
          resource: { type: 'workitems.item', id: String(itemRef), title: item.title },
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
