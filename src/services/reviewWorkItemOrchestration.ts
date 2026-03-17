import { getReviewById } from '../server/db/repositories/reviewsRepo';
import { findWorkItemByReviewRefs, updateWorkItemRecordById } from '../server/db/repositories/workItemsRepo';
import { WorkItemStatus } from '../types';

export const closeReviewWorkItemRecord = async ({
  reviewId,
  cycleId,
  actorDisplayName,
  resolution
}: {
  reviewId: string;
  cycleId: string;
  actorDisplayName: string;
  resolution?: string;
}) => {
  const item = await findWorkItemByReviewRefs({ reviewId, cycleId });
  if (!item) return null;
  const now = new Date().toISOString();

  await updateWorkItemRecordById(String(item._id || item.id), {
    set: { status: WorkItemStatus.DONE, updatedAt: now, resolution },
    activityEntry: {
      user: actorDisplayName,
      action: 'CHANGED_STATUS',
      from: item.status,
      to: WorkItemStatus.DONE,
      createdAt: now
    }
  });

  return { item, now };
};

export const syncReviewCycleWorkItemRecord = async ({
  reviewId,
  cycleId,
  actorDisplayName
}: {
  reviewId: string;
  cycleId: string;
  actorDisplayName?: string;
}) => {
  const review = await getReviewById(reviewId);
  if (!review) return null;
  const cycle = (review.cycles || []).find((c) => c.cycleId === cycleId);
  if (!cycle) return null;

  const statusMap: Record<string, WorkItemStatus> = {
    requested: WorkItemStatus.TODO,
    in_review: WorkItemStatus.IN_PROGRESS,
    feedback_sent: WorkItemStatus.REVIEW,
    vendor_addressing: WorkItemStatus.REVIEW,
    closed: WorkItemStatus.DONE
  };
  const desiredStatus = statusMap[cycle.status] || WorkItemStatus.TODO;

  const item = await findWorkItemByReviewRefs({ reviewId, cycleId });
  if (!item) return null;

  const updates: any = {
    reviewCycleStatus: cycle.status,
    updatedAt: new Date().toISOString()
  };
  if (!item.linkedResource?.id && review.resource?.id) {
    updates.linkedResource = {
      ...(item.linkedResource || {}),
      type: review.resource?.type,
      id: String(review.resource.id),
      title: review.resource?.title
    };
  }
  if (cycle.vendorResponse?.body) {
    updates.reviewVendorResponse = cycle.vendorResponse.body;
    updates.reviewVendorResponseAt = cycle.vendorResponse.submittedAt;
    updates.reviewVendorResponseBy = cycle.vendorResponse.submittedBy;
  }
  if (cycle.reviewerNote?.body) {
    updates.reviewReviewerNote = cycle.reviewerNote.body;
  }
  if (Array.isArray(cycle.feedbackAttachments)) {
    updates.reviewFeedbackAttachments = cycle.feedbackAttachments;
  }
  if (item.status !== desiredStatus) {
    updates.status = desiredStatus;
  }

  await updateWorkItemRecordById(String(item._id || item.id), {
    set: updates,
    activityEntry: item.status !== desiredStatus
      ? {
          user: actorDisplayName || 'System',
          action: 'CHANGED_STATUS',
          from: item.status,
          to: desiredStatus,
          createdAt: updates.updatedAt
        }
      : undefined
  });

  return { item, review, cycle, desiredStatus, updatedAt: updates.updatedAt };
};
