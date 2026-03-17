import { getServerDb } from '../server/db/client';
import { listArchitectureDiagrams } from '../server/db/repositories/architectureRepo';
import { listReviewsByResourceIds } from '../server/db/repositories/reviewsRepo';
import { listUsersByIds } from '../server/db/repositories/usersRepo';

export const fetchArchitectureDiagramsWithReviewSummary = async (filters: any = {}) => {
  try {
    const db = await getServerDb();
    const diagrams = await listArchitectureDiagrams(filters);
    if (!diagrams.length) return diagrams;

    const diagramIds = diagrams.map((d: any) => String(d._id || d.id || '')).filter(Boolean);
    if (!diagramIds.length) return diagrams;

    const reviews = await listReviewsByResourceIds('architecture_diagram', diagramIds);
    const reviewByResourceId = new Map<string, any>();
    const reviewerIdSet = new Set<string>();
    const reviewStoryPairs: Array<{ reviewId: string; cycleId: string }> = [];

    reviews.forEach((review: any) => {
      const resourceId = String(review.resource?.id || '');
      if (!resourceId) return;
      const currentCycle = (review.cycles || []).find((c: any) => c.cycleId === review.currentCycleId);
      const reviewerUserIds = (currentCycle?.reviewerUserIds || review.currentReviewerUserIds || []).map((id: any) => String(id));
      reviewerUserIds.forEach((id: string) => reviewerIdSet.add(id));
      const cycleId = String(review.currentCycleId || '');
      const reviewKey = `${review.resource?.type}:${review.resource?.id}`;
      const reviewObjectId = review._id ? String(review._id) : '';
      if (cycleId) {
        reviewStoryPairs.push({ reviewId: reviewKey, cycleId });
        if (reviewObjectId) reviewStoryPairs.push({ reviewId: reviewObjectId, cycleId });
      }
      reviewByResourceId.set(resourceId, {
        reviewId: reviewObjectId || reviewKey,
        reviewKeyId: reviewKey,
        currentCycleId: cycleId,
        currentCycleStatus: currentCycle?.status || review.currentCycleStatus,
        currentCycleNumber: currentCycle?.number,
        currentDueAt: currentCycle?.dueAt || review.currentDueAt,
        currentReviewerUserIds: reviewerUserIds
      });
    });

    const reviewerUsers = reviewerIdSet.size ? await listUsersByIds(Array.from(reviewerIdSet)) : [];
    const reviewerMap = new Map<string, any>();
    reviewerUsers.forEach((u: any) => reviewerMap.set(String(u._id || u.id), u));

    const storyMap = new Map<string, { id: string; key: string }>();
    if (reviewStoryPairs.length) {
      const orClauses = reviewStoryPairs.map((pair) => ({
        reviewId: pair.reviewId,
        reviewCycleId: pair.cycleId
      }));
      const stories = await db.collection('workitems').find({ $or: orClauses }).project({ _id: 1, key: 1, reviewId: 1, reviewCycleId: 1 }).toArray();
      stories.forEach((story: any) => {
        const mapKey = `${String(story.reviewId)}:${String(story.reviewCycleId)}`;
        storyMap.set(mapKey, { id: String(story._id || story.id || ''), key: String(story.key || '') });
      });
    }

    return diagrams.map((diagram: any) => {
      const resourceId = String(diagram._id || diagram.id || '');
      const summary = reviewByResourceId.get(resourceId);
      if (!summary) return diagram;
      const reviewers = (summary.currentReviewerUserIds || []).map((id: string) => {
        const user = reviewerMap.get(id);
        return {
          userId: id,
          displayName: user?.name || user?.email || 'Reviewer',
          email: user?.email
        };
      });
      const storyKey = summary.currentCycleId ? `${summary.reviewId}:${summary.currentCycleId}` : '';
      const storyKeyAlt = summary.currentCycleId ? `${summary.reviewKeyId}:${summary.currentCycleId}` : '';
      const story = storyMap.get(storyKey) || storyMap.get(storyKeyAlt) || null;
      return {
        ...diagram,
        reviewSummary: {
          reviewId: summary.reviewId,
          reviewKeyId: summary.reviewKeyId,
          currentCycleId: summary.currentCycleId,
          currentCycleStatus: summary.currentCycleStatus,
          currentCycleNumber: summary.currentCycleNumber,
          currentDueAt: summary.currentDueAt,
          reviewers,
          story
        }
      };
    });
  } catch {
    return await listArchitectureDiagrams(filters);
  }
};
