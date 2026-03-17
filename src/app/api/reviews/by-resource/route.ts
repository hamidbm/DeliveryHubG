import { NextResponse } from 'next/server';
import { ensureInReview } from '../../../../services/reviewLifecycle';
import { requireUser } from '../../../../shared/auth/guards';
import { getReviewByResource } from '../../../../server/db/repositories/reviewsRepo';

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const actor = {
      userId: auth.principal.userId,
      displayName: auth.principal.fullName || 'Unknown',
      email: auth.principal.email
    };
    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');
    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'resourceType and resourceId are required' }, { status: 400 });
    }
    let review = await getReviewByResource(resourceType, resourceId);
    if (review && review.currentCycleId) {
      const currentCycle = (review.cycles || []).find((c) => c.cycleId === review.currentCycleId);
      const reviewerIds = Array.isArray(currentCycle?.reviewerUserIds)
        ? currentCycle.reviewerUserIds.map((id: unknown) => String(id))
        : Array.isArray(currentCycle?.reviewers)
          ? currentCycle.reviewers.map((reviewer: any) => String(reviewer.userId || ''))
          : [];
      const isReviewer = reviewerIds.includes(actor.userId);
      if (isReviewer && currentCycle?.status === 'requested' && review._id) {
        review =
          (await ensureInReview({
            reviewId: String(review._id),
            cycleId: currentCycle.cycleId,
            actor
          })) || review;
      }
    }
    return NextResponse.json(review || null);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch review' }, { status: 500 });
  }
}
