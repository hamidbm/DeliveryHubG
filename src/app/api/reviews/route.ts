import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { ensureInReview, fetchReview } from '../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const requireAuth = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return { ok: false, status: 401, payload: null };
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return { ok: true, status: 200, payload };
};

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return NextResponse.json({ error: 'Unauthenticated' }, { status: auth.status });
    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');
    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'resourceType and resourceId are required' }, { status: 400 });
    }
    let review = await fetchReview(resourceType, resourceId);
    if (review && review.currentCycleId && auth.payload?.userId) {
      const currentCycle = (review.cycles || []).find((c) => c.cycleId === review.currentCycleId);
      const isReviewer = Boolean(currentCycle?.reviewerUserIds?.includes(String(auth.payload.userId)));
      if (isReviewer && currentCycle?.status === 'requested' && review._id) {
        review = await ensureInReview({
          reviewId: String(review._id),
          cycleId: currentCycle.cycleId,
          actor: {
            userId: String(auth.payload.userId || ''),
            displayName: String(auth.payload.name || 'Unknown'),
            email: auth.payload.email ? String(auth.payload.email) : undefined
          }
        }) || review;
      }
    }
    return NextResponse.json(review || null);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch review' }, { status: 500 });
  }
}
