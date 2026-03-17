import { NextResponse } from 'next/server';
import { getWorkItemAttachmentById } from '../../../../../server/db/repositories/workItemAttachmentsRepo';
import { requireUser } from '../../../../../shared/auth/guards';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const asset = await getWorkItemAttachmentById(id);
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const data = asset.data?.buffer ? asset.data.buffer : asset.data;
    const body = data instanceof Buffer ? data : Buffer.from(data || []);

    return new NextResponse(body, {
      headers: {
        'Content-Type': asset.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${asset.filename || 'attachment'}"`,
        'Cache-Control': 'private, max-age=3600'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Download failed' }, { status: 500 });
  }
}
