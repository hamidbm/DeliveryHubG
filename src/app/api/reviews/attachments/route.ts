import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../shared/events/emitEvent';
import { addReviewCycleAttachments } from '../../../../services/reviewLifecycle';
import { requireStandardUser } from '../../../../shared/auth/guards';
import { getReviewByResource } from '../../../../server/db/repositories/reviewsRepo';

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      displayName: auth.principal.fullName || 'Unknown',
      email: auth.principal.email
    };
    const body = await request.json();
    const resourceType = String(body.resourceType || '');
    const resourceId = String(body.resourceId || '');
    const resourceTitle = body.resourceTitle ? String(body.resourceTitle) : undefined;
    const cycleId = String(body.cycleId || '');
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    if (!resourceType || !resourceId || !cycleId || attachments.length === 0) {
      return NextResponse.json({ error: 'resourceType, resourceId, cycleId, and attachments are required.' }, { status: 400 });
    }

    const review = await getReviewByResource(resourceType, resourceId);
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    const currentCycle = review.cycles?.find((c) => c.cycleId === cycleId);
    if (!currentCycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });

    const isReviewer = (currentCycle.reviewers || []).some((r) => String(r.userId) === user.userId);
    if (!isReviewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const updated = await addReviewCycleAttachments({ review, cycleId, attachments });

    await emitEvent({
      ts: new Date().toISOString(),
      type: 'reviews.cycle.attachmentuploaded',
      actor: user,
      resource: { type: resourceType, id: resourceId, title: resourceTitle },
      payload: { cycleId, attachments },
      correlationId: cycleId
    });

    return NextResponse.json({ review: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to add attachments' }, { status: 500 });
  }
}
