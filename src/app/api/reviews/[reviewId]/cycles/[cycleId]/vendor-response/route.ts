import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../../../../shared/events/emitEvent';
import { updateReviewCycleNote, syncReviewCycleWorkItem } from '../../../../../../../services/reviewLifecycle';
import { requireStandardUser } from '../../../../../../../shared/auth/guards';
import { getReviewById } from '../../../../../../../server/db/repositories/reviewsRepo';

export async function POST(request: Request, { params }: { params: Promise<{ reviewId: string; cycleId: string }> }) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      displayName: auth.principal.fullName || 'Unknown',
      email: auth.principal.email
    };
    const { reviewId, cycleId } = await params;
    const review = await getReviewById(reviewId);
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    const cycle = (review.cycles || []).find((c) => c.cycleId === cycleId);
    if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    if (String(cycle.requestedBy?.userId || '') !== user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (!['feedback_sent', 'vendor_addressing'].includes(cycle.status)) {
      return NextResponse.json({ error: 'Vendor response cannot be updated at this stage.' }, { status: 409 });
    }

    const body = await request.json();
    const noteBody = String(body?.body || '').trim();
    const ifMatchUpdatedAt = body?.ifMatchUpdatedAt ? String(body.ifMatchUpdatedAt) : null;
    if (ifMatchUpdatedAt && review.updatedAt && new Date(review.updatedAt).getTime() > new Date(ifMatchUpdatedAt).getTime()) {
      return NextResponse.json({ error: 'This review changed since you opened it. Please refresh.' }, { status: 409 });
    }
    if (!noteBody) return NextResponse.json({ error: 'Response body is required.' }, { status: 400 });

    const updated = await updateReviewCycleNote({
      review,
      cycleId,
      vendorResponse: {
        body: noteBody,
        submittedAt: new Date().toISOString(),
        submittedBy: user
      }
    });

    await syncReviewCycleWorkItem({ reviewId: String(review._id), cycleId, actor: user });

    await emitEvent({
      ts: new Date().toISOString(),
      type: 'review.response.saved',
      actor: user,
      resource: { type: review.resource.type, id: review.resource.id, title: review.resource.title },
      payload: { reviewId, cycleId, kind: 'vendor' },
      correlationId: cycleId
    });

    return NextResponse.json({ review: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save vendor response' }, { status: 500 });
  }
}
