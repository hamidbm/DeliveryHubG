import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { ensureInReview, fetchReviewById, updateReviewCycleStatus, emitReviewCycleEvent } from '../../../../../../../services/db';

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
    const isReviewer = (cycle.reviewerUserIds || []).includes(user.userId);
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
      type: 'review.cycle.feedbacksent',
      actor: user,
      resource: { type: review.resource.type, id: review.resource.id, title: review.resource.title },
      cycle: { cycleId, number: cycle.number, status: 'feedback_sent' }
    });

    return NextResponse.json({ review: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to mark feedback sent' }, { status: 500 });
  }
}
