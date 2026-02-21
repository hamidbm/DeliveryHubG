import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { fetchReview, updateReviewCycleStatus } from '../../../../services/db';
import { canSubmitForReview, canResubmit, canMarkFeedbackSent } from '../../../../services/authz';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUser = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    displayName: String(payload.name || 'Unknown'),
    email: payload.email ? String(payload.email) : undefined,
    role: payload.role ? String(payload.role) : undefined
  };
};

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    if (!(canSubmitForReview(user) || canResubmit(user) || canMarkFeedbackSent(user))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const resourceType = String(body.resourceType || '');
    const resourceId = String(body.resourceId || '');
    const cycleId = String(body.cycleId || '');
    const dueAt = body.dueAt ? String(body.dueAt) : undefined;
    const notes = body.notes ? String(body.notes) : undefined;

    if (!resourceType || !resourceId || !cycleId) {
      return NextResponse.json({ error: 'resourceType, resourceId, and cycleId are required.' }, { status: 400 });
    }

    const review = await fetchReview(resourceType, resourceId);
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    const currentStatus = (review.cycles?.find((c) => c.cycleId === cycleId)?.status || 'requested') as any;
    const updated = await updateReviewCycleStatus({
      review,
      cycleId,
      status: currentStatus,
      notes,
      dueAt
    });

    return NextResponse.json({ review: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update review' }, { status: 500 });
  }
}
