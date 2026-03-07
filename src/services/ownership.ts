import { ObjectId } from 'mongodb';
import { getDb, fetchBundleAssignments } from './db';

type Candidate = {
  userId: string;
  email?: string;
  reason: string;
  score: number;
};

const resolveAdminCandidates = async () => {
  const db = await getDb();
  const adminDocs = await db.collection('admins').find({}).toArray();
  const adminIds = adminDocs.map((a: any) => String(a.userId || '')).filter(Boolean);
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
  const assignments = await fetchBundleAssignments({ bundleId, assignmentType: 'bundle_owner', active: true });
  const ownerIds = assignments.map((a) => String(a.userId)).filter(Boolean);
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

const resolveUsers = async (userIds: string[]) => {
  const db = await getDb();
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return new Map<string, any>();
  const objectIds = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
  const users = await db.collection('users').find({
    $or: [
      { _id: { $in: objectIds } },
      { id: { $in: ids } },
      { userId: { $in: ids } }
    ]
  }).toArray();
  const map = new Map<string, any>();
  users.forEach((u: any) => {
    const id = String(u._id || u.id || u.userId || '');
    if (id) map.set(id, u);
  });
  return map;
};

const dedupeCandidates = (candidates: Candidate[]) => {
  const map = new Map<string, Candidate>();
  candidates.forEach((c) => {
    const key = c.userId;
    if (!map.has(key)) {
      map.set(key, c);
    } else {
      const existing = map.get(key)!;
      if (c.score > existing.score) {
        map.set(key, { ...existing, ...c, score: c.score, reason: `${existing.reason}; ${c.reason}` });
      }
    }
  });
  return Array.from(map.values()).sort((a, b) => b.score - a.score);
};

export const suggestOwnersForWorkItem = async (workItemId: string) => {
  const db = await getDb();
  const item = ObjectId.isValid(workItemId)
    ? await db.collection('workitems').findOne({ _id: new ObjectId(workItemId) })
    : await db.collection('workitems').findOne({ $or: [{ id: workItemId }, { key: workItemId }] });
  if (!item) return { candidates: [] as Candidate[] };

  const bundleId = String(item.bundleId || '');
  if (!bundleId) return { candidates: [] as Candidate[] };

  const bundleOwners = await fetchBundleAssignments({ bundleId, assignmentType: 'bundle_owner', active: true });
  const ownerIds = bundleOwners.map((a) => String(a.userId)).filter(Boolean);
  const ownerUsers = await resolveUsers(ownerIds);

  const watcherDocs = await db.collection('notification_watchers').find({
    scopeType: 'BUNDLE',
    scopeId: bundleId
  }).toArray();
  const watcherIds = watcherDocs.map((w: any) => String(w.userId || '')).filter(Boolean);
  const watcherUsers = await resolveUsers(watcherIds);

  const recentItems = await db.collection('workitems')
    .find({ bundleId, type: item.type, assigneeUserIds: { $exists: true, $ne: [] } }, { projection: { assigneeUserIds: 1, updatedAt: 1 } })
    .sort({ updatedAt: -1 })
    .limit(30)
    .toArray();
  const recentCounts = new Map<string, number>();
  recentItems.forEach((wi: any) => {
    const ids = Array.isArray(wi.assigneeUserIds) ? wi.assigneeUserIds.map(String) : [];
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
  const db = await getDb();
  const milestone = ObjectId.isValid(milestoneId)
    ? await db.collection('milestones').findOne({ _id: new ObjectId(milestoneId) })
    : await db.collection('milestones').findOne({ $or: [{ id: milestoneId }, { name: milestoneId }] });
  if (!milestone) return { candidates: [] as Candidate[] };

  const candidates: Candidate[] = [];
  const bundleIds = new Set<string>();
  if (milestone.bundleId) bundleIds.add(String(milestone.bundleId));

  const milestoneKeyCandidates = new Set<string>();
  if (milestone._id) milestoneKeyCandidates.add(String(milestone._id));
  if (milestone.id) milestoneKeyCandidates.add(String(milestone.id));
  if (milestone.name) milestoneKeyCandidates.add(String(milestone.name));
  const candidateIds = Array.from(milestoneKeyCandidates);
  const candidateObjectIds = candidateIds.filter(ObjectId.isValid).map((id) => new ObjectId(id));

  const items = await db.collection('workitems').find({
    $and: [
      { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] },
      { $or: [
        { milestoneIds: { $in: candidateIds } },
        { milestoneIds: { $in: candidateObjectIds } },
        { milestoneId: { $in: candidateIds } },
        { milestoneId: { $in: candidateObjectIds } }
      ] }
    ]
  }, { projection: { bundleId: 1, storyPoints: 1 } }).toArray();

  const bundlePoints = new Map<string, number>();
  items.forEach((item: any) => {
    const bId = item.bundleId ? String(item.bundleId) : '';
    if (!bId) return;
    bundleIds.add(bId);
    const points = typeof item.storyPoints === 'number' ? item.storyPoints : 0;
    bundlePoints.set(bId, (bundlePoints.get(bId) || 0) + points);
  });

  const bundlesByPoints = Array.from(bundleIds).sort((a, b) => (bundlePoints.get(b) || 0) - (bundlePoints.get(a) || 0));

  for (const bundleId of bundlesByPoints) {
    const assignments = await fetchBundleAssignments({ bundleId, assignmentType: 'bundle_owner', active: true });
    const ownerIds = assignments.map((a) => String(a.userId)).filter(Boolean);
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

  const adminCandidates = await resolveAdminCandidates();
  candidates.push(...adminCandidates);

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
  if (bundleId) {
    candidates.push(...(await resolveBundleOwnerCandidates(bundleId)));
  }
  candidates.push(...(await resolveAdminCandidates()));
  return { candidates: dedupeCandidates(candidates) };
};

export const suggestOwnersForGeneratedArtifact = async ({
  bundleId
}: {
  bundleId: string;
}) => {
  const candidates: Candidate[] = [];
  candidates.push(...(await resolveBundleOwnerCandidates(bundleId)));
  candidates.push(...(await resolveAdminCandidates()));
  return { candidates: dedupeCandidates(candidates) };
};

export const resolveMilestoneBundleScope = async (milestoneId: string) => {
  const db = await getDb();
  const milestone = ObjectId.isValid(milestoneId)
    ? await db.collection('milestones').findOne({ _id: new ObjectId(milestoneId) })
    : await db.collection('milestones').findOne({ $or: [{ id: milestoneId }, { name: milestoneId }] });
  if (!milestone) return [];
  const bundleIds = new Set<string>();
  if (milestone.bundleId) bundleIds.add(String(milestone.bundleId));
  const ids = [String(milestone._id || ''), String(milestone.id || ''), String(milestone.name || '')].filter(Boolean);
  const objectIds = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
  const items = await db.collection('workitems').find({
    $or: [
      { milestoneIds: { $in: ids } },
      { milestoneIds: { $in: objectIds } },
      { milestoneId: { $in: ids } },
      { milestoneId: { $in: objectIds } }
    ]
  }, { projection: { bundleId: 1 } }).toArray();
  items.forEach((item: any) => {
    if (item?.bundleId) bundleIds.add(String(item.bundleId));
  });
  return Array.from(bundleIds).filter(Boolean);
};
