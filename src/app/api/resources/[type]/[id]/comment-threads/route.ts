import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { createCommentThread, fetchCommentThreads, emitEvent, fetchReviewById, resolveMentionUsers, ensureInReview } from '../../../../../../services/db';
import { extractMentionTokens } from '../../../../../../lib/mentions';

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

export async function GET(request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    const { type, id } = await params;
    const threads = await fetchCommentThreads(type, id);
    return NextResponse.json(threads);
  } catch {
    return NextResponse.json({ error: 'Failed to load comment threads' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    const user = await getUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { type, id } = await params;
    const body = await request.json();
    if (!body?.message?.trim()) {
      return NextResponse.json({ error: 'Message body is required.' }, { status: 400 });
    }

    const resourceTitle = body.resourceTitle ? String(body.resourceTitle) : undefined;
    const anchor = body.anchor;

    const mentionTokens = extractMentionTokens(body.message);
    const mentionUsers = await resolveMentionUsers(mentionTokens);
    const mentionUserIds = mentionUsers.map((u) => u.userId).filter(Boolean);

    const reviewId = body.reviewId ? String(body.reviewId) : undefined;
    const reviewCycleId = body.reviewCycleId ? String(body.reviewCycleId) : undefined;
    if (reviewId && reviewCycleId) {
      const review = await fetchReviewById(reviewId);
      const cycle = review?.cycles?.find((c) => c.cycleId === reviewCycleId);
      const isReviewer = Boolean(cycle?.reviewerUserIds?.includes(user.userId));
      if (review && cycle && cycle.status === 'requested' && isReviewer) {
        await ensureInReview({ reviewId, cycleId: reviewCycleId, actor: user });
      }
    }

    const result = await createCommentThread({
      resource: { type, id, title: resourceTitle },
      anchor,
      body: body.message.trim(),
      author: user,
      mentions: mentionUserIds,
      reviewId,
      reviewCycleId
    });

    await emitEvent({
      ts: new Date().toISOString(),
      type: 'comments.thread.created',
      actor: user,
      resource: { type, id, title: resourceTitle },
      payload: { threadId: result.threadId, reviewId, reviewCycleId },
      correlationId: result.threadId
    });

    await emitEvent({
      ts: new Date().toISOString(),
      type: 'comments.message.created',
      actor: user,
      resource: { type, id, title: resourceTitle },
      payload: { threadId: result.threadId, reviewId, reviewCycleId },
      correlationId: result.threadId
    });

    for (const mentionedUserId of mentionUserIds) {
      await emitEvent({
        ts: new Date().toISOString(),
        type: 'comments.message.mentioned',
        actor: user,
        resource: { type, id, title: resourceTitle },
        payload: { threadId: result.threadId, mentionedUserId, reviewId, reviewCycleId },
        correlationId: result.threadId
      });
    }

    return NextResponse.json({ success: true, threadId: result.threadId });
  } catch (error: any) {
    console.error('Failed to create comment thread', error);
    return NextResponse.json({ error: error.message || 'Failed to create thread' }, { status: 500 });
  }
}
