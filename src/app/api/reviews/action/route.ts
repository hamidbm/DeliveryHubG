import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { emitReviewCycleEvent, fetchReview, updateReviewCycleStatus } from '../../../../services/db';
import { canCloseCycle, canResubmit } from '../../../../services/authz';

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
    const authUser = await getUser();
    if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
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

    const review = await fetchReview(resourceType, resourceId);
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
        ? 'review.cycle.feedbacksent'
        : action === 'resubmitted'
          ? 'review.cycle.resubmitted'
          : action === 'vendor_addressing'
            ? 'review.cycle.vendoraddressing'
            : 'review.cycle.closed';

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
