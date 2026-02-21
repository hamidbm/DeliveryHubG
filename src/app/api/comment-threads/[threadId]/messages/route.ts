import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { addCommentMessage, fetchCommentMessages, emitEvent, fetchCommentThreadById, resolveMentionUsers } from '../../../../../services/db';
import { extractMentionTokens } from '../../../../../lib/mentions';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUserFromCookies = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    displayName: String(payload.name || 'Unknown'),
    email: payload.email ? String(payload.email) : undefined
  };
};

export async function GET(request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await params;
    const messages = await fetchCommentMessages(threadId);
    return NextResponse.json(messages);
  } catch (error: any) {
    console.error('Failed to load comment messages', error);
    return NextResponse.json({ error: error.message || 'Failed to load messages' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const user = await getUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { threadId } = await params;
    const body = await request.json();
    if (!body?.message?.trim()) {
      return NextResponse.json({ error: 'Message body is required.' }, { status: 400 });
    }

    const mentionTokens = extractMentionTokens(body.message);
    const mentionUsers = await resolveMentionUsers(mentionTokens);
    const mentionUserIds = mentionUsers.map((u) => u.userId).filter(Boolean);

    await addCommentMessage({
      threadId,
      body: body.message.trim(),
      author: user,
      mentions: mentionUserIds
    });

    const thread = await fetchCommentThreadById(threadId);
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
