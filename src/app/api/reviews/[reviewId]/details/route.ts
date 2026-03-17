import { NextResponse } from 'next/server';
import { requireUser } from '../../../../../shared/auth/guards';
import { getReviewById, getReviewCycleCommentStats } from '../../../../../server/db/repositories/reviewsRepo';

export async function GET(request: Request, { params }: { params: Promise<{ reviewId: string }> }) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const { reviewId } = await params;
    const review = await getReviewById(reviewId);
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    const cycleIds = (review.cycles || []).map((cycle: any) => cycle.cycleId).filter(Boolean);
    const { threadCounts, messageCounts } = await getReviewCycleCommentStats(cycleIds);

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
