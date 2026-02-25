import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { fetchReview, fetchReviewById, syncReviewCycleWorkItem } from '../../../../services/db';

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

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const reviewId = body.reviewId ? String(body.reviewId) : '';
    const cycleId = body.cycleId ? String(body.cycleId) : '';
    const resourceType = body.resourceType ? String(body.resourceType) : '';
    const resourceId = body.resourceId ? String(body.resourceId) : '';
    if (!cycleId) return NextResponse.json({ error: 'cycleId is required.' }, { status: 400 });

    let review = null;
    if (reviewId) {
      review = await fetchReviewById(reviewId);
    }
    if (!review && resourceType && resourceId) {
      review = await fetchReview(resourceType, resourceId);
    }
    if (!review?._id) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    await syncReviewCycleWorkItem({ reviewId: String(review._id), cycleId, actor: user });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to sync review' }, { status: 500 });
  }
}
