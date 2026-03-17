import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../../shared/events/emitEvent';
import { resolveMentionUsers } from '../../../../../services/userDirectory';
import { extractMentionTokens } from '../../../../../lib/mentions';
import { requireCommentPermission } from '../../../../../shared/auth/guards';
import { addCommentMessageRecord, getCommentThreadById, listCommentMessages } from '../../../../../server/db/repositories/commentThreadsRepo';

export async function GET(request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await params;
    const messages = await listCommentMessages(threadId);
    return NextResponse.json(messages);
  } catch (error: any) {
    console.error('Failed to load comment messages', error);
    return NextResponse.json({ error: error.message || 'Failed to load messages' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const auth = await requireCommentPermission();
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      displayName: auth.principal.fullName || 'Unknown',
      email: auth.principal.email
    };

    const { threadId } = await params;
    const body = await request.json();
    if (!body?.message?.trim()) {
      return NextResponse.json({ error: 'Message body is required.' }, { status: 400 });
    }

    const mentionTokens = extractMentionTokens(body.message);
    const mentionUsers = await resolveMentionUsers(mentionTokens);
    const mentionUserIds = mentionUsers.map((u) => u.userId).filter(Boolean);

    await addCommentMessageRecord({
      threadId,
      body: body.message.trim(),
      author: user,
      mentions: mentionUserIds
    });

    const thread = await getCommentThreadById(threadId);
    const reviewId = thread?.reviewId;
    const reviewCycleId = thread?.reviewCycleId;

    await emitEvent({
      ts: new Date().toISOString(),
      type: 'comments.message.created',
      actor: user,
      resource: { type: body.resourceType || 'wiki.unknown', id: body.resourceId || '' },
      payload: { threadId, reviewId, reviewCycleId },
      correlationId: threadId
    });

    for (const mentionedUserId of mentionUserIds) {
      await emitEvent({
        ts: new Date().toISOString(),
        type: 'comments.message.mentioned',
        actor: user,
        resource: { type: body.resourceType || 'wiki.unknown', id: body.resourceId || '' },
        payload: { threadId, mentionedUserId, reviewId, reviewCycleId },
        correlationId: threadId
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to post comment message', error);
    return NextResponse.json({ error: error.message || 'Failed to post message' }, { status: 500 });
  }
}
