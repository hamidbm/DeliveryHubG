import { NextResponse } from 'next/server';
import { emitReviewCycleEvent, updateReviewCycleStatus } from '../../../../services/reviewLifecycle';
import { canCloseCycle, canResubmit } from '../../../../services/authz';
import { requireUser } from '../../../../shared/auth/guards';
import { getReviewByResource } from '../../../../server/db/repositories/reviewsRepo';

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const authUser = {
      userId: auth.principal.userId,
      displayName: auth.principal.fullName || 'Unknown',
      email: auth.principal.email,
      role: auth.principal.role || undefined,
      accountType: auth.principal.accountType
    };
    const actor = {
      userId: authUser.userId,
      displayName: authUser.displayName,
      email: authUser.email
    };

    const body = await request.json();
    const resourceType = String(body.resourceType || '');
    const resourceId = String(body.resourceId || '');
    const resourceTitle = body.resourceTitle ? String(body.resourceTitle) : undefined;
    const action = String(body.action || '');
    const notes = body.notes ? String(body.notes) : undefined;

    if (!resourceType || !resourceId || !action) {
      return NextResponse.json({ error: 'resourceType, resourceId, and action are required.' }, { status: 400 });
    }

    const review = await getReviewByResource(resourceType, resourceId);
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    const cycleId = review.currentCycleId;
    const currentCycle = (review.cycles || []).find((c) => c.cycleId === cycleId);
    if (!currentCycle) return NextResponse.json({ error: 'Active cycle not found' }, { status: 404 });

    const isReviewer = (currentCycle.reviewers || []).some((r) => String(r.userId) === authUser.userId);
    if (action === 'feedback_sent' && !isReviewer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (action === 'resubmitted' && !(canResubmit(authUser))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (action === 'vendor_addressing' && !(canResubmit(authUser))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (action === 'closed' && !(await canCloseCycle(authUser))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updated = await updateReviewCycleStatus({
      review,
      cycleId,
      status: action as any,
      notes
    });

    const eventType =
      action === 'feedback_sent'
        ? 'reviews.cycle.feedbacksent'
        : action === 'resubmitted'
          ? 'reviews.cycle.resubmitted'
          : action === 'vendor_addressing'
            ? 'reviews.cycle.vendoraddressing'
            : 'reviews.cycle.closed';

    await emitReviewCycleEvent({
      type: eventType as any,
      actor,
      resource: { type: resourceType, id: resourceId, title: resourceTitle },
      cycle: { cycleId: currentCycle.cycleId, number: currentCycle.number, status: action }
    });

    return NextResponse.json({ review: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update review' }, { status: 500 });
  }
}
