import { NextResponse } from 'next/server';
import { fetchWorkItemById } from '../../../../../../services/workItemsService';
import { ObjectId } from 'mongodb';
import { requireStandardUser } from '../../../../../../shared/auth/guards';
import { deleteWorkItemAttachmentRecord } from '../../../../../../server/db/repositories/workItemAttachmentsRepo';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  try {
    const { id, attachmentId } = await params;
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!ObjectId.isValid(attachmentId)) {
      return NextResponse.json({ error: 'Invalid attachment id' }, { status: 400 });
    }

    await deleteWorkItemAttachmentRecord(id, attachmentId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Delete failed' }, { status: 500 });
  }
}
