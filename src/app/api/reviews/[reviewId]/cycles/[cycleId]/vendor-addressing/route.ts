import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { fetchReviewById, updateReviewCycleStatus } from '../../../../../../../services/db';

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
