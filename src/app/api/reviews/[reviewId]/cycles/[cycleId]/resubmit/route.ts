import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { appendReviewCycle, emitReviewCycleEvent, fetchReviewById, updateReviewCycleStatus, closeReviewWorkItem, createReviewWorkItem } from '../../../../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUser = async () => {
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

export async function POST(request: Request, { params }: { params: Promise<{ reviewId: string; cycleId: string }> }) {
  try {
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { reviewId, cycleId } = await params;
    const review = await fetchReviewById(reviewId);
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    const cycle = (review.cycles || []).find((c) => c.cycleId === cycleId);
    if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });

    if (String(cycle.requestedBy?.userId || '') !== user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (!['feedback_sent', 'vendor_addressing'].includes(cycle.status)) {
      return NextResponse.json({ error: 'Cycle not eligible for resubmit.' }, { status: 409 });
    }

    const closedReview = await updateReviewCycleStatus({
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
      resolution: 'superseded'
    });

    const { review: updated, cycle: newCycle } = await appendReviewCycle({
      review: closedReview,
      bundleId: review.resource?.bundleId || '',
      requestedBy: user,
      reviewers: cycle.reviewers,
      notes: undefined,
      dueAt: undefined
    });

    await emitReviewCycleEvent({
      type: 'reviews.cycle.resubmitted',
      actor: user,
      resource: { type: review.resource.type, id: review.resource.id, title: review.resource.title },
      cycle: { cycleId: newCycle.cycleId, number: newCycle.number, status: 'requested' }
    });

    await createReviewWorkItem({
      reviewId: String(review._id || `${review.resource.type}:${review.resource.id}`),
      cycleId: newCycle.cycleId,
      cycleNumber: newCycle.number,
      eventType: 'reviews.cycle.resubmitted',
      resource: { type: review.resource.type, id: review.resource.id, title: review.resource.title },
      bundleId: review.resource?.bundleId,
      applicationId: review.resource?.applicationId,
      dueAt: newCycle.dueAt,
      requestedBy: user,
      reviewers: newCycle.reviewers,
      actor: user
    });

    return NextResponse.json({ review: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to resubmit review' }, { status: 500 });
  }
}
