import { getReviewById, getReviewByResource } from '../server/db/repositories/reviewsRepo';
import {
  addReviewCycleAttachments,
  appendReviewCycle,
  updateReviewCycleNote,
  updateReviewCycleStatus
} from './reviewCycles';
import { closeReviewWorkItemRecord, syncReviewCycleWorkItemRecord } from './reviewWorkItemOrchestration';
import { createReviewWorkItemRecord } from './workPlanOrchestration';
import { emitEvent } from '../shared/events/emitEvent';

export const fetchReview = async (resourceType: string, resourceId: string) => getReviewByResource(resourceType, resourceId);

export const fetchReviewById = async (reviewId: string) => getReviewById(reviewId);

export const emitReviewCycleEvent = async ({
  type,
  actor,
  resource,
  cycle
}: {
  type:
    | 'reviews.cycle.requested'
    | 'reviews.cycle.inreview'
    | 'reviews.cycle.feedbacksent'
    | 'reviews.cycle.resubmitted'
    | 'reviews.cycle.vendoraddressing'
    | 'reviews.cycle.closed';
  actor: { userId: string; displayName: string; email?: string };
  resource: { type: string; id: string; title?: string };
  cycle: { cycleId: string; number: number; status: string };
}) => {
  return await emitEvent({
    ts: new Date().toISOString(),
    type,
    actor,
    resource,
    payload: {
      reviewCycleId: cycle.cycleId,
      cycleNumber: cycle.number,
      cycleStatus: cycle.status
    },
    correlationId: cycle.cycleId
  });
};

export const syncReviewCycleWorkItem = async ({
  reviewId,
  cycleId,
  actor
}: {
  reviewId: string;
  cycleId: string;
  actor: { userId?: string; displayName?: string; email?: string };
}) => {
  const outcome = await syncReviewCycleWorkItemRecord({
    reviewId,
    cycleId,
    actorDisplayName: actor.displayName || actor.email || 'System'
  });
  return outcome?.item || null;
};

export const closeReviewWorkItem = async ({
  reviewId,
  cycleId,
  actor,
  resolution
}: {
  reviewId: string;
  cycleId: string;
  actor: { userId?: string; displayName?: string; email?: string };
  resolution?: string;
}) => {
  const outcome = await closeReviewWorkItemRecord({
    reviewId,
    cycleId,
    actorDisplayName: actor.displayName || actor.email || 'System',
    resolution
  });
  return outcome?.item || null;
};

export const ensureInReview = async ({
  reviewId,
  cycleId,
  actor
}: {
  reviewId: string;
  cycleId: string;
  actor: { userId: string; displayName: string; email?: string };
}) => {
  const review = await fetchReviewById(reviewId);
  if (!review) return null;
  const cycle = (review.cycles || []).find((c) => c.cycleId === cycleId);
  if (!cycle || cycle.status !== 'requested') return review;
  const updated = await updateReviewCycleStatus({
    review,
    cycleId,
    status: 'in_review',
    actor
  });
  await emitReviewCycleEvent({
    type: 'reviews.cycle.inreview',
    actor,
    resource: { type: review.resource.type, id: review.resource.id, title: review.resource.title },
    cycle: { cycleId: cycle.cycleId, number: cycle.number, status: 'in_review' }
  });
  return updated;
};

export {
  addReviewCycleAttachments,
  appendReviewCycle,
  createReviewWorkItemRecord as createReviewWorkItem,
  updateReviewCycleNote,
  updateReviewCycleStatus
};
