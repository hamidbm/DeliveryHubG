import { NextResponse } from 'next/server';
import { updateReviewCycleStatus } from '../../../../../../../services/reviewLifecycle';
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
    const review = await getReviewById(reviewId);
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    const cycle = (review.cycles || []).find((c) => c.cycleId === cycleId);
    if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });

    if (String(cycle.requestedBy?.userId || '') !== user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (cycle.status !== 'feedback_sent') {
      return NextResponse.json({ error: 'Cycle not eligible for vendor addressing.' }, { status: 409 });
    }

    const updated = await updateReviewCycleStatus({
      review,
      cycleId,
      status: 'vendor_addressing',
      actor: user
    });

    return NextResponse.json({ review: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update status' }, { status: 500 });
  }
}
