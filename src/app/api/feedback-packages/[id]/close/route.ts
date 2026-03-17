import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../../shared/events/emitEvent';
import { fetchReview, updateReviewCycleStatus, emitReviewCycleEvent, closeReviewWorkItem, syncReviewCycleWorkItem } from '../../../../../services/reviewLifecycle';
import { closeFeedbackPackageRecord } from '../../../../../server/db/repositories/feedbackPackagesRepo';
import { canCloseCycle } from '../../../../../services/authz';
import { requireStandardUser } from '../../../../../shared/auth/guards';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    if (!(await canCloseCycle(user))) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const resourceType = body.resourceType ? String(body.resourceType) : undefined;
    const resourceId = body.resourceId ? String(body.resourceId) : undefined;
    const resourceTitle = body.resourceTitle ? String(body.resourceTitle) : undefined;

    await closeFeedbackPackageRecord(id, user.userId);

    if (resourceType && resourceId) {
      const review = (await fetchReview(resourceType, resourceId)) as any;
      if (review?.currentCycleId) {
        const cycle = (review.cycles || []).find((c) => c.cycleId === review.currentCycleId);
        if (cycle && cycle.status !== 'closed') {
          await updateReviewCycleStatus({
            review,
            cycleId: review.currentCycleId,
            status: 'closed',
            actor: user
          });
          await emitReviewCycleEvent({
            type: 'reviews.cycle.closed',
            actor: user,
            resource: { type: review.resource.type, id: review.resource.id, title: review.resource.title },
            cycle: { cycleId: review.currentCycleId, number: cycle.number, status: 'closed' }
          });
          await closeReviewWorkItem({
            reviewId: String(review._id || `${review.resource.type}:${review.resource.id}`),
            cycleId: review.currentCycleId,
            actor: user,
            resolution: 'closed'
          });
          await syncReviewCycleWorkItem({ reviewId: String(review._id), cycleId: review.currentCycleId, actor: user });
        }
      }
      await emitEvent({
        ts: new Date().toISOString(),
        type: 'feedback.package.closed',
        actor: user,
        resource: { type: resourceType, id: resourceId, title: resourceTitle },
        payload: { feedbackPackageId: id },
        correlationId: id
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to close feedback package' }, { status: 500 });
  }
}
