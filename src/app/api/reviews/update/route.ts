import { NextResponse } from 'next/server';
import { updateReviewCycleStatus } from '../../../../services/reviewLifecycle';
import { canSubmitForReview, canResubmit, canMarkFeedbackSent } from '../../../../services/authz';
import { requireStandardUser } from '../../../../shared/auth/guards';
import { getReviewByResource } from '../../../../server/db/repositories/reviewsRepo';

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      displayName: auth.principal.fullName || 'Unknown',
      email: auth.principal.email,
      role: auth.principal.role || undefined,
      accountType: auth.principal.accountType
    };
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

    const review = await getReviewByResource(resourceType, resourceId);
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
