import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getDb, fetchReviewById } from '../../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const requireAuth = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return { ok: false, status: 401, payload: null };
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return { ok: true, status: 200, payload };
};

export async function GET(_: Request, { params }: { params: Promise<{ reviewId: string }> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return NextResponse.json({ error: 'Unauthenticated' }, { status: auth.status });
    const { reviewId } = await params;
    const review = await fetchReviewById(reviewId);
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    const cycleIds = (review.cycles || []).map((cycle: any) => cycle.cycleId).filter(Boolean);
    const db = await getDb();
    const threads = cycleIds.length
      ? await db.collection('comment_threads').find({ reviewCycleId: { $in: cycleIds } }).toArray()
      : [];

    const threadCounts: Record<string, number> = {};
    const messageCounts: Record<string, number> = {};
    threads.forEach((thread: any) => {
      const cycleId = String(thread.reviewCycleId || '');
      if (!cycleId) return;
      threadCounts[cycleId] = (threadCounts[cycleId] || 0) + 1;
      const count = typeof thread.messageCount === 'number' ? thread.messageCount : 0;
      messageCounts[cycleId] = (messageCounts[cycleId] || 0) + count;
    });

    const cycleSummaries = (review.cycles || []).map((cycle: any) => ({
      cycleId: cycle.cycleId,
      number: cycle.number,
      status: cycle.status,
      requestedAt: cycle.requestedAt,
      inReviewAt: cycle.inReviewAt,
      feedbackSentAt: cycle.feedbackSentAt,
      closedAt: cycle.closedAt,
      dueAt: cycle.dueAt,
      reviewers: cycle.reviewers || [],
      feedbackAttachmentCount: Array.isArray(cycle.feedbackAttachments) ? cycle.feedbackAttachments.length : 0,
      hasReviewerNote: Boolean(cycle.reviewerNote?.body),
      hasVendorResponse: Boolean(cycle.vendorResponse?.body),
      reviewCommentThreadCount: threadCounts[cycle.cycleId] || 0,
      reviewCommentMessageCount: messageCounts[cycle.cycleId] || 0
    }));

    const serializedReview = {
      ...review,
      _id: String(review._id)
    };

    return NextResponse.json({ review: serializedReview, cycleSummaries });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch review details' }, { status: 500 });
  }
}
