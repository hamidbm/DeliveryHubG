import { NextResponse } from 'next/server';
import { ensureInReview, updateReviewCycleStatus, emitReviewCycleEvent, syncReviewCycleWorkItem } from '../../../../../../../services/reviewLifecycle';
import { WorkItemStatus } from '../../../../../../../types';
import { requireStandardUser } from '../../../../../../../shared/auth/guards';
import { getReviewById } from '../../../../../../../server/db/repositories/reviewsRepo';
import { findWorkItemByReviewRefs, updateWorkItemRecordById } from '../../../../../../../server/db/repositories/workItemsRepo';

export async function POST(request: Request, { params }: { params: Promise<{ reviewId: string; cycleId: string }> }) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      displayName: auth.principal.fullName || 'Unknown',
      email: auth.principal.email
    };
    const { reviewId, cycleId } = await params;
    const review = (await getReviewById(reviewId)) as any;
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    const cycle = (review.cycles || []).find((c) => c.cycleId === cycleId);
    if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    const reviewerIds = Array.isArray(cycle.reviewerUserIds)
      ? cycle.reviewerUserIds.map((id: unknown) => String(id))
      : Array.isArray(cycle.reviewers)
        ? cycle.reviewers.map((reviewer: any) => String(reviewer.userId || ''))
        : [];
    const isReviewer = reviewerIds.includes(user.userId);
    if (!isReviewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    if (!['requested', 'in_review'].includes(cycle.status)) {
      return NextResponse.json({ error: 'Cycle not eligible for feedback sent.' }, { status: 409 });
    }

    await ensureInReview({ reviewId, cycleId, actor: user });
    const updated = await updateReviewCycleStatus({
      review,
      cycleId,
      status: 'feedback_sent',
      actor: user
    });

    await emitReviewCycleEvent({
      type: 'reviews.cycle.feedbacksent',
      actor: user,
      resource: { type: review.resource.type, id: review.resource.id, title: review.resource.title },
      cycle: { cycleId, number: cycle.number, status: 'feedback_sent' }
    });

    try {
      const item = await findWorkItemByReviewRefs({
        reviewId: String(review._id || `${review.resource.type}:${review.resource.id}`),
        cycleId
      });
      if (item && item.status !== WorkItemStatus.REVIEW) {
        const now = new Date().toISOString();
        await updateWorkItemRecordById(String(item._id || item.id), {
          set: { status: WorkItemStatus.REVIEW, updatedAt: now },
          activityEntry: {
            user: user.displayName,
            action: 'CHANGED_STATUS',
            from: item.status,
            to: WorkItemStatus.REVIEW,
            createdAt: now
          }
        });
      }
    } catch {}
    await syncReviewCycleWorkItem({ reviewId: String(review._id), cycleId, actor: user });

    return NextResponse.json({ review: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to mark feedback sent' }, { status: 500 });
  }
}
