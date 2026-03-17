import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../../../../shared/events/emitEvent';
import { ensureInReview, updateReviewCycleNote } from '../../../../../../../services/reviewLifecycle';
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
    const review = (await getReviewById(reviewId)) as any;
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    const cycle = (review.cycles || []).find((c) => c.cycleId === cycleId);
    if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    const reviewerIds = Array.isArray(cycle.reviewerUserIds)
      ? cycle.reviewerUserIds.map((id: unknown) => String(id))
      : Array.isArray(cycle.reviewers)
        ? cycle.reviewers.map((reviewer: any) => String(reviewer.userId || ''))
        : [];
    const isReviewer = reviewerIds.includes(user.userId);
    if (!isReviewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    if (!['requested', 'in_review'].includes(cycle.status)) {
      return NextResponse.json({ error: 'Reviewer note cannot be updated at this stage.' }, { status: 409 });
    }

    const preCycleStatus = cycle.status;
    const ensuredReview = (await ensureInReview({ reviewId, cycleId, actor: user })) as any;
    const reviewToUse = ensuredReview || review;
    const ensuredCycle = (reviewToUse.cycles || []).find((c) => c.cycleId === cycleId);
    const body = await request.json();
    const noteBody = String(body?.body || '').trim();
    const ifMatchUpdatedAt = body?.ifMatchUpdatedAt ? String(body.ifMatchUpdatedAt) : null;
    const allowStaleMatch = preCycleStatus === 'requested' && ensuredCycle?.status === 'in_review';
    if (
      ifMatchUpdatedAt &&
      reviewToUse.updatedAt &&
      new Date(reviewToUse.updatedAt).getTime() > new Date(ifMatchUpdatedAt).getTime() &&
      !allowStaleMatch
    ) {
      return NextResponse.json({ error: 'This review changed since you opened it. Please refresh.' }, { status: 409 });
    }
    if (!noteBody) return NextResponse.json({ error: 'Note body is required.' }, { status: 400 });

    const updated = await updateReviewCycleNote({
      review: reviewToUse,
      cycleId,
      reviewerNote: {
        body: noteBody,
        createdAt: new Date().toISOString(),
        createdBy: user
      }
    });

    await emitEvent({
      ts: new Date().toISOString(),
      type: 'review.note.saved',
      actor: user,
      resource: { type: review.resource.type, id: review.resource.id, title: review.resource.title },
      payload: { reviewId, cycleId, kind: 'reviewer' },
      correlationId: cycleId
    });

    return NextResponse.json({ review: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save reviewer note' }, { status: 500 });
  }
}
