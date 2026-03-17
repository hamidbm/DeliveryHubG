import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../shared/events/emitEvent';
import { requireStandardUser } from '../../../../shared/auth/guards';
import { setCommentThreadStatus } from '../../../../server/db/repositories/commentThreadsRepo';

export async function PATCH(request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      displayName: auth.principal.fullName || 'Unknown',
      email: auth.principal.email
    };

    const { threadId } = await params;
    const body = await request.json();
    const status = body?.status === 'resolved' ? 'resolved' : 'open';
    await setCommentThreadStatus(threadId, status);

    await emitEvent({
      ts: new Date().toISOString(),
      type: status === 'resolved' ? 'comments.thread.resolved' : 'comments.thread.reopened',
      actor: user,
      resource: { type: body.resourceType || 'wiki.unknown', id: body.resourceId || '' },
      payload: { threadId },
      correlationId: threadId
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update thread' }, { status: 500 });
  }
}
