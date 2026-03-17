import { listAdmins } from '../server/db/repositories/adminsRepo';
import { listBundleAssignments } from '../server/db/repositories/bundleAssignmentsRepo';
import { getMilestoneByRef } from '../server/db/repositories/milestonesRepo';
import { listUsersByAnyIds } from '../server/db/repositories/usersRepo';
import {
  findWorkItemByIdOrKey,
  listRecentAssignedWorkItemsForBundle,
  listWorkItemsByMilestoneRefs
} from '../server/db/repositories/workItemsRepo';
import { listWatcherUserIdsForScopeRecord } from '../server/db/repositories/watchersRepo';

type Candidate = {
  userId: string;
  email?: string;
  reason: string;
  score: number;
};

const resolveUsers = async (userIds: string[]) => {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return new Map<string, any>();
  const users = await listUsersByAnyIds(ids);
  const map = new Map<string, any>();
  users.forEach((user: any) => {
    [user?._id, user?.id, user?.userId]
      .map((value) => (value ? String(value) : ''))
      .filter(Boolean)
      .forEach((key) => map.set(key, user));
  });
  return map;
};

const resolveAdminCandidates = async () => {
  const admins = await listAdmins();
  const adminIds = admins.map((admin: any) => String(admin.userId || '')).filter(Boolean);
  const adminUsers = await resolveUsers(adminIds);
  return adminIds.map((id) => {
    const user = adminUsers.get(id);
    return {
      userId: id,
      email: user?.email,
      reason: 'Admin/CMO',
      score: 95
    };
  });
};

const resolveBundleOwnerCandidates = async (bundleId: string) => {
  const assignments = await listBundleAssignments({ bundleId, assignmentType: 'bundle_owner', active: true });
  const ownerIds = assignments.map((assignment) => String(assignment.userId)).filter(Boolean);
  const ownerUsers = await resolveUsers(ownerIds);
  return ownerIds.map((id) => {
    const user = ownerUsers.get(id);
    return {
      userId: id,
      email: user?.email,
      reason: 'Bundle owner',
      score: 100
    };
  });
};

const dedupeCandidates = (candidates: Candidate[]) => {
  const map = new Map<string, Candidate>();
  candidates.forEach((candidate) => {
    const key = candidate.userId;
    if (!map.has(key)) {
      map.set(key, candidate);
      return;
    }
    const existing = map.get(key)!;
    if (candidate.score > existing.score) {
      map.set(key, { ...existing, ...candidate, score: candidate.score, reason: `${existing.reason}; ${candidate.reason}` });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.score - a.score);
};

const buildMilestoneRefs = (milestone: any) => {
  return [milestone?._id, milestone?.id, milestone?.name]
    .map((value) => (value ? String(value) : ''))
    .filter(Boolean);
};

export const suggestOwnersForWorkItem = async (workItemId: string) => {
  const item = await findWorkItemByIdOrKey(workItemId);
  if (!item) return { candidates: [] as Candidate[] };

  const bundleId = String(item.bundleId || '');
  if (!bundleId) return { candidates: [] as Candidate[] };

  const bundleOwners = await listBundleAssignments({ bundleId, assignmentType: 'bundle_owner', active: true });
  const ownerIds = bundleOwners.map((assignment) => String(assignment.userId)).filter(Boolean);
  const ownerUsers = await resolveUsers(ownerIds);

  const watcherIds = await listWatcherUserIdsForScopeRecord('BUNDLE', bundleId);
  const watcherUsers = await resolveUsers(watcherIds);

  const recentItems = await listRecentAssignedWorkItemsForBundle(bundleId, String(item.type || ''));
  const recentCounts = new Map<string, number>();
  recentItems.forEach((workItem: any) => {
    const ids = Array.isArray(workItem.assigneeUserIds) ? workItem.assigneeUserIds.map(String) : [];
    ids.forEach((id: string) => {
      if (!id) return;
      recentCounts.set(id, (recentCounts.get(id) || 0) + 1);
    });
  });
  const recentUsers = await resolveUsers(Array.from(recentCounts.keys()));

  const candidates: Candidate[] = [];
  ownerIds.forEach((id) => {
    const user = ownerUsers.get(id);
    candidates.push({
      userId: id,
      email: user?.email,
      reason: 'Bundle owner',
      score: 100
    });
  });

  recentCounts.forEach((count, id) => {
    const user = recentUsers.get(id);
    candidates.push({
      userId: id,
      email: user?.email,
      reason: `Recent assignee (${count})`,
      score: 70 + Math.min(count, 10)
    });
  });

  watcherIds.forEach((id) => {
    const user = watcherUsers.get(id);
    candidates.push({
      userId: id,
      email: user?.email,
      reason: 'Bundle watcher',
      score: 40
    });
  });

  return { candidates: dedupeCandidates(candidates) };
};

export const suggestOwnersForMilestone = async (milestoneId: string) => {
  const milestone = await getMilestoneByRef(milestoneId);
  if (!milestone) return { candidates: [] as Candidate[] };

  const candidates: Candidate[] = [];
  const bundleIds = new Set<string>();
  if (milestone.bundleId) bundleIds.add(String(milestone.bundleId));

  const items = await listWorkItemsByMilestoneRefs(buildMilestoneRefs(milestone));
  const bundlePoints = new Map<string, number>();
  items.forEach((item: any) => {
    const bundleId = item.bundleId ? String(item.bundleId) : '';
    if (!bundleId) return;
    bundleIds.add(bundleId);
    const points = typeof item.storyPoints === 'number' ? item.storyPoints : 0;
    bundlePoints.set(bundleId, (bundlePoints.get(bundleId) || 0) + points);
  });

  const bundlesByPoints = Array.from(bundleIds).sort((a, b) => (bundlePoints.get(b) || 0) - (bundlePoints.get(a) || 0));
  for (const bundleId of bundlesByPoints) {
    const assignments = await listBundleAssignments({ bundleId, assignmentType: 'bundle_owner', active: true });
    const ownerIds = assignments.map((assignment) => String(assignment.userId)).filter(Boolean);
    const ownerUsers = await resolveUsers(ownerIds);
    ownerIds.forEach((id) => {
      const user = ownerUsers.get(id);
      const points = bundlePoints.get(bundleId) || 0;
      candidates.push({
        userId: id,
        email: user?.email,
        reason: points ? `Bundle owner (${points} pts scoped)` : 'Bundle owner',
        score: 90 + Math.min(points, 50) / 10
      });
    });
  }

  candidates.push(...(await resolveAdminCandidates()));
  return { candidates: dedupeCandidates(candidates) };
};

export const suggestOwnersForMilestoneScope = async ({
  scopeType,
  scopeId,
  bundleId
}: {
  scopeType: 'BUNDLE' | 'APPLICATION' | 'PROGRAM';
  scopeId: string;
  bundleId?: string;
}) => {
  const candidates: Candidate[] = [];
  if (bundleId) candidates.push(...(await resolveBundleOwnerCandidates(bundleId)));
  candidates.push(...(await resolveAdminCandidates()));
  return { candidates: dedupeCandidates(candidates) };
};

export const suggestOwnersForGeneratedArtifact = async ({ bundleId }: { bundleId: string }) => {
  const candidates: Candidate[] = [];
  candidates.push(...(await resolveBundleOwnerCandidates(bundleId)));
  candidates.push(...(await resolveAdminCandidates()));
  return { candidates: dedupeCandidates(candidates) };
};

export const resolveMilestoneBundleScope = async (milestoneId: string) => {
  const milestone = await getMilestoneByRef(milestoneId);
  if (!milestone) return [];
  const bundleIds = new Set<string>();
  if (milestone.bundleId) bundleIds.add(String(milestone.bundleId));
  const items = await listWorkItemsByMilestoneRefs(buildMilestoneRefs(milestone));
  items.forEach((item: any) => {
    if (item?.bundleId) bundleIds.add(String(item.bundleId));
  });
  return Array.from(bundleIds).filter(Boolean);
};
