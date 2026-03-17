import { NextResponse } from 'next/server';
import { syncReviewCycleWorkItem } from '../../../../services/reviewLifecycle';
import { requireStandardUser } from '../../../../shared/auth/guards';
import { getReviewById, getReviewByResource } from '../../../../server/db/repositories/reviewsRepo';

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      displayName: auth.principal.fullName || 'Unknown',
      email: auth.principal.email
    };
    const body = await request.json().catch(() => ({}));
    const reviewId = body.reviewId ? String(body.reviewId) : '';
    const cycleId = body.cycleId ? String(body.cycleId) : '';
    const resourceType = body.resourceType ? String(body.resourceType) : '';
    const resourceId = body.resourceId ? String(body.resourceId) : '';
    if (!cycleId) return NextResponse.json({ error: 'cycleId is required.' }, { status: 400 });

    let review = null;
    if (reviewId) {
      review = await getReviewById(reviewId);
    }
    if (!review && resourceType && resourceId) {
      review = await getReviewByResource(resourceType, resourceId);
    }
    if (!review?._id) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    await syncReviewCycleWorkItem({ reviewId: String(review._id), cycleId, actor: user });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to sync review' }, { status: 500 });
  }
}
