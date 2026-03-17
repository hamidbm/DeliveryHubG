import { ObjectId } from 'mongodb';
import type { AttachmentRef, CommentAuthor, ReviewCycle, ReviewRecord, ReviewReviewer } from '../types';
import { listBundleAssignments } from '../server/db/repositories/bundleAssignmentsRepo';
import { saveReviewRecord } from '../server/db/repositories/reviewsRepo';
import { listUsersByIds } from '../server/db/repositories/usersRepo';

export const fetchAssignedCmoReviewers = async (bundleId: string): Promise<ReviewReviewer[]> => {
  try {
    const assignments = await listBundleAssignments({
      bundleId,
      active: true,
      assignmentType: 'assigned_cmo'
    });
    const userIds = assignments.map((a: any) => String(a.userId));
    const users = await listUsersByIds(userIds);
    const userMap = new Map(users.map((u: any) => [String(u._id || u.id), u]));
    return userIds
      .map((id) => userMap.get(id))
      .filter(Boolean)
      .map((user: any) => ({
        userId: String(user._id || user.id),
        displayName: user.name || user.email || 'Reviewer',
        email: user.email
      }));
  } catch {
    return [];
  }
};

export const buildReviewCycle = async ({
  bundleId,
  cycleNumber,
  requestedBy,
  reviewers,
  status = 'requested',
  notes,
  dueAt
}: {
  bundleId: string;
  cycleNumber: number;
  requestedBy: { userId: string; displayName: string; email?: string };
  reviewers?: ReviewReviewer[];
  status?: ReviewCycle['status'];
  notes?: string;
  dueAt?: string;
}): Promise<ReviewCycle> => {
  const autoReviewers = reviewers && reviewers.length
    ? reviewers
    : (bundleId ? await fetchAssignedCmoReviewers(bundleId) : []);
  const cycleId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : new ObjectId().toHexString();
  const now = new Date().toISOString();
  const defaultDueAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  return {
    cycleId,
    number: cycleNumber,
    status,
    requestedBy,
    requestedAt: now,
    reviewers: autoReviewers,
    reviewerUserIds: autoReviewers.map((r) => r.userId),
    dueAt: dueAt || defaultDueAt,
    notes,
    correlationId: cycleId
  };
};

export const addReviewCycleAttachments = async ({
  review,
  cycleId,
  attachments
}: {
  review: ReviewRecord;
  cycleId: string;
  attachments: AttachmentRef[];
}) => {
  const cycles = (review.cycles || []).map((cycle) => {
    if (cycle.cycleId !== cycleId) return cycle;
    const existing = cycle.feedbackAttachments || [];
    return {
      ...cycle,
      feedbackAttachments: [...existing, ...attachments]
    };
  });
  const updated: ReviewRecord = {
    ...review,
    cycles,
    updatedAt: new Date().toISOString()
  };
  await saveReviewRecord(updated);
  return updated;
};

export const appendReviewCycle = async ({
  review,
  bundleId,
  requestedBy,
  reviewers,
  notes,
  dueAt
}: {
  review: ReviewRecord;
  bundleId: string;
  requestedBy: { userId: string; displayName: string; email?: string };
  reviewers?: ReviewReviewer[];
  notes?: string;
  dueAt?: string;
}) => {
  const cycle = await buildReviewCycle({
    bundleId,
    cycleNumber: (review.cycles?.length || 0) + 1,
    requestedBy,
    reviewers,
    notes,
    dueAt
  });
  const updated: ReviewRecord = {
    ...review,
    status: 'active',
    currentCycleId: cycle.cycleId,
    currentCycleStatus: cycle.status,
    currentDueAt: cycle.dueAt,
    currentReviewerUserIds: cycle.reviewerUserIds,
    currentRequestedAt: cycle.requestedAt,
    currentRequestedByUserId: cycle.requestedBy.userId,
    cycles: [...(review.cycles || []), cycle],
    updatedAt: new Date().toISOString()
  };
  await saveReviewRecord(updated);
  return { review: updated, cycle };
};

export const updateReviewCycleStatus = async ({
  review,
  cycleId,
  status,
  notes,
  dueAt,
  actor
}: {
  review: ReviewRecord;
  cycleId: string;
  status: ReviewCycle['status'];
  notes?: string;
  dueAt?: string;
  actor?: { userId: string; displayName: string; email?: string };
}) => {
  const now = new Date().toISOString();
  const cycles = (review.cycles || []).map((cycle) => {
    if (cycle.cycleId !== cycleId) return cycle;
    const updated: ReviewCycle = {
      ...cycle,
      status,
      notes: notes ?? cycle.notes,
      dueAt: dueAt ?? cycle.dueAt,
      completedAt: status === 'feedback_sent' ? now : cycle.completedAt,
      inReviewAt: status === 'in_review' ? cycle.inReviewAt || now : cycle.inReviewAt,
      inReviewBy: status === 'in_review' ? cycle.inReviewBy || actor : cycle.inReviewBy,
      feedbackSentAt: status === 'feedback_sent' ? now : cycle.feedbackSentAt,
      feedbackSentBy: status === 'feedback_sent' ? actor : cycle.feedbackSentBy,
      closedAt: status === 'closed' ? now : cycle.closedAt,
      closedBy: status === 'closed' ? actor : cycle.closedBy
    };
    return updated;
  });
  const currentCycle = cycles.find((cycle) => cycle.cycleId === review.currentCycleId);
  const hasOpenCycle = cycles.some((cycle) => cycle.status !== 'closed');
  const updated: ReviewRecord = {
    ...review,
    status: status === 'closed' ? (hasOpenCycle ? 'active' : 'closed') : review.status,
    currentCycleStatus: currentCycle?.status || review.currentCycleStatus,
    currentDueAt: currentCycle?.dueAt || review.currentDueAt,
    currentReviewerUserIds: currentCycle?.reviewerUserIds || review.currentReviewerUserIds,
    currentRequestedAt: currentCycle?.requestedAt || review.currentRequestedAt,
    currentRequestedByUserId: currentCycle?.requestedBy?.userId || review.currentRequestedByUserId,
    cycles,
    updatedAt: now
  };
  await saveReviewRecord(updated);
  return updated;
};

export const updateReviewCycleNote = async ({
  review,
  cycleId,
  reviewerNote,
  vendorResponse
}: {
  review: ReviewRecord;
  cycleId: string;
  reviewerNote?: { body: string; createdAt: string; createdBy: CommentAuthor };
  vendorResponse?: { body: string; submittedAt: string; submittedBy: CommentAuthor };
}) => {
  const cycles = (review.cycles || []).map((cycle) => {
    if (cycle.cycleId !== cycleId) return cycle;
    return {
      ...cycle,
      reviewerNote: reviewerNote ?? cycle.reviewerNote,
      vendorResponse: vendorResponse ?? cycle.vendorResponse
    };
  });
  const currentCycle = cycles.find((cycle) => cycle.cycleId === review.currentCycleId);
  const updated: ReviewRecord = {
    ...review,
    currentCycleStatus: currentCycle?.status || review.currentCycleStatus,
    currentDueAt: currentCycle?.dueAt || review.currentDueAt,
    currentReviewerUserIds: currentCycle?.reviewerUserIds || review.currentReviewerUserIds,
    currentRequestedAt: currentCycle?.requestedAt || review.currentRequestedAt,
    currentRequestedByUserId: currentCycle?.requestedBy?.userId || review.currentRequestedByUserId,
    cycles,
    updatedAt: new Date().toISOString()
  };
  await saveReviewRecord(updated);
  return updated;
};
