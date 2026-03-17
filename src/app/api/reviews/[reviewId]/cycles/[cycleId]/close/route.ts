import { NextResponse } from 'next/server';
import { emitReviewCycleEvent, updateReviewCycleStatus, closeReviewWorkItem, syncReviewCycleWorkItem } from '../../../../../../../services/reviewLifecycle';
import { requireStandardUser } from '../../../../../../../shared/auth/guards';
import { getReviewById } from '../../../../../../../server/db/repositories/reviewsRepo';

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

    if (String(cycle.requestedBy?.userId || '') !== user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (!['feedback_sent', 'vendor_addressing'].includes(cycle.status)) {
      return NextResponse.json({ error: 'Cycle not eligible for close.' }, { status: 409 });
    }

    const updated = await updateReviewCycleStatus({
      review,
      cycleId,
      status: 'closed',
      actor: user
    });

    await emitReviewCycleEvent({
      type: 'reviews.cycle.closed',
      actor: user,
      resource: { type: review.resource.type, id: review.resource.id, title: review.resource.title },
      cycle: { cycleId, number: cycle.number, status: 'closed' }
    });

    await closeReviewWorkItem({
      reviewId: String(review._id || `${review.resource.type}:${review.resource.id}`),
      cycleId,
      actor: user,
      resolution: 'closed'
    });
    await syncReviewCycleWorkItem({ reviewId: String(review._id), cycleId, actor: user });

    return NextResponse.json({ review: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to close review' }, { status: 500 });
  }
}
