import { NextResponse } from 'next/server';
import { getDb, fetchWorkItemById } from '../../../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  try {
    const { id, attachmentId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    await jwtVerify(token, JWT_SECRET);
    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!ObjectId.isValid(attachmentId)) {
      return NextResponse.json({ error: 'Invalid attachment id' }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date().toISOString();

    await db.collection('workitems_attachments').deleteOne({ _id: new ObjectId(attachmentId) });
    await db.collection('workitems').updateOne(
      { _id: new ObjectId(id) },
      { $pull: { attachments: { assetId: attachmentId } }, $set: { updatedAt: now } } as any
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Delete failed' }, { status: 500 });
  }
}
