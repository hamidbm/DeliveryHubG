import { ObjectId } from 'mongodb';
import { WorkItemStatus, WorkItemType } from '../../../types';
import { getServerDb } from '../client';
import { findApplicationByAnyId } from './applicationsRepo';
import { findBundleByAnyId } from './bundlesRepo';
import { listMilestones } from './milestonesRepo';

const safeIdMatch = (value?: string) => {
  if (!value) return undefined;
  return ObjectId.isValid(value) ? new ObjectId(value) : value;
};

const collectRefCandidates = (...values: Array<unknown>) => {
  const out: Array<string | ObjectId> = [];
  const seen = new Set<string>();
  values.forEach((value) => {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
    if (ObjectId.isValid(normalized)) out.push(new ObjectId(normalized));
  });
  return out;
};

const resolveBundleMatch = async (value?: string | null) => {
  if (!value || value === 'all') return undefined;
  const bundle = await findBundleByAnyId(String(value)).catch(() => null);
  const candidates = collectRefCandidates(value, bundle?._id, bundle?.id, bundle?.key);
  return candidates.length ? { $in: candidates } : safeIdMatch(String(value));
};

const resolveApplicationMatch = async (value?: string | null) => {
  if (!value || value === 'all') return undefined;
  const application = await findApplicationByAnyId(String(value)).catch(() => null);
  const candidates = collectRefCandidates(value, application?._id, application?.id, application?.aid);
  return candidates.length ? { $in: candidates } : safeIdMatch(String(value));
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let warnedLegacyWorkItems = false;
const warnLegacyWorkItems = async (db: any) => {
  if (warnedLegacyWorkItems) return;
  warnedLegacyWorkItems = true;
  try {
    const legacyCount = await db.collection('work_items').countDocuments({}, { limit: 1 });
    if (legacyCount > 0) {
      console.warn('Legacy collection work_items contains data. Work Items now use workitems; consider migrating.');
    }
  } catch {
    // Best-effort warning only.
  }
};

export const ensureWorkItemsIndexes = async () => {
  const db = await getServerDb();
  await db.collection('workitems').createIndex({ bundleId: 1 });
  await db.collection('workitems').createIndex({ applicationId: 1 });
  await db.collection('workitems').createIndex({ status: 1, updatedAt: -1 });
  await db.collection('workitems').createIndex({ assignedTo: 1, updatedAt: -1 });
  await db.collection('workitems').createIndex({ parentId: 1 });
  await db.collection('workitems').createIndex({ sprintId: 1, status: 1 });
  await db.collection('workitems').createIndex({ rank: 1 });
  await db.collection('workitems').createIndex({ key: 1 }, { unique: false });
  await db.collection('workitems').createIndex({ dedupKey: 1 }, { unique: true, sparse: true });
  await db.collection('workitems').createIndex({ 'scopeRef.type': 1, 'scopeRef.id': 1 });
  await db.collection('workitems').createIndex({ 'links.targetId': 1 });
  await db.collection('workitems').createIndex({ 'links.type': 1 });
  await db.collection('workitems').createIndex({ 'jira.host': 1, 'jira.key': 1 }, { unique: true, sparse: true });
  await db.collection('workitems').createIndex({ milestoneIds: 1, status: 1 });
  await db.collection('workitems').createIndex({ milestoneIds: 1, type: 1, status: 1 });
  await db.collection('workitems').createIndex({ dueAt: 1, status: 1 });
  return db;
};

const canonicalWorkItemLinkTypes = new Set(['BLOCKS', 'RELATES_TO', 'DUPLICATES']);
const legacyInverseWorkItemLinkTypes = new Set(['IS_BLOCKED_BY', 'IS_DUPLICATED_BY']);

const normalizeWorkItemId = (item: any) => {
  const id = item?._id || item?.id || '';
  return id ? String(id) : '';
};

const resolveWorkItemFilter = (id: string) => {
  if (ObjectId.isValid(id)) return { _id: new ObjectId(id) };
  return { $or: [{ id }, { key: id }] };
};

const collectWorkItemIdCandidates = (ids: string[]) => {
  const candidates: Array<string | ObjectId> = [];
  ids.forEach((id) => {
    if (!id) return;
    candidates.push(id);
    if (ObjectId.isValid(id)) candidates.push(new ObjectId(id));
  });
  return candidates;
};

const addUniqueLinkSummary = (
  list: any[],
  seen: Set<string>,
  entry: { type: string; targetId: string; targetKey?: string; targetTitle?: string; targetStatus?: string }
) => {
  const key = `${entry.type}:${entry.targetId}`;
  if (seen.has(key)) return;
  seen.add(key);
  list.push(entry);
};

export const deriveWorkItemLinkSummary = async (items: any[]) => {
  if (!items.length) return items;
  const db = await ensureWorkItemsIndexes();
  await warnLegacyWorkItems(db);

  const itemIds = new Set<string>();
  items.forEach((item) => {
    const id = normalizeWorkItemId(item);
    if (id) itemIds.add(id);
    if (item?.key) itemIds.add(String(item.key));
  });
  const itemIdList = Array.from(itemIds);
  if (!itemIdList.length) return items;

  const idCandidates = collectWorkItemIdCandidates(itemIdList);
  const inboundItems = await db.collection('workitems')
    .find({ 'links.targetId': { $in: idCandidates } }, { projection: { _id: 1, id: 1, key: 1, title: 1, status: 1, links: 1 } })
    .toArray();

  const inboundByTarget = new Map<string, any[]>();
  const addInbound = (targetId: string, source: any, linkType: string) => {
    const key = String(targetId);
    if (!inboundByTarget.has(key)) inboundByTarget.set(key, []);
    inboundByTarget.get(key)!.push({ source, linkType });
  };

  inboundItems.forEach((source) => {
    (source.links || []).forEach((link: any) => {
      if (!link?.targetId || !link?.type) return;
      const targetId = String(link.targetId);
      if (!itemIds.has(targetId)) return;
      addInbound(targetId, source, String(link.type));
    });
  });

  return items.map((item) => {
    const id = normalizeWorkItemId(item);
    const summary = {
      blocks: [] as any[],
      blockedBy: [] as any[],
      duplicates: [] as any[],
      duplicatedBy: [] as any[],
      relatesTo: [] as any[],
      openBlockersCount: 0
    };
    const seen = {
      blocks: new Set<string>(),
      blockedBy: new Set<string>(),
      duplicates: new Set<string>(),
      duplicatedBy: new Set<string>(),
      relatesTo: new Set<string>()
    };

    (item.links || []).forEach((link: any) => {
      if (!link?.targetId || !link?.type) return;
      const targetId = String(link.targetId);
      const entry = {
        type: String(link.type),
        targetId,
        targetKey: link.targetKey,
        targetTitle: link.targetTitle
      };
      if (canonicalWorkItemLinkTypes.has(entry.type)) {
        if (entry.type === 'BLOCKS') addUniqueLinkSummary(summary.blocks, seen.blocks, entry);
        if (entry.type === 'DUPLICATES') addUniqueLinkSummary(summary.duplicates, seen.duplicates, entry);
        if (entry.type === 'RELATES_TO') addUniqueLinkSummary(summary.relatesTo, seen.relatesTo, entry);
      }
      if (legacyInverseWorkItemLinkTypes.has(entry.type)) {
        if (entry.type === 'IS_BLOCKED_BY') addUniqueLinkSummary(summary.blockedBy, seen.blockedBy, { ...entry, type: 'BLOCKED_BY' });
        if (entry.type === 'IS_DUPLICATED_BY') addUniqueLinkSummary(summary.duplicatedBy, seen.duplicatedBy, { ...entry, type: 'DUPLICATED_BY' });
      }
    });

    const inbound = inboundByTarget.get(id) || [];
    inbound.forEach(({ source, linkType }) => {
      const targetEntry = {
        type: String(linkType),
        targetId: normalizeWorkItemId(source),
        targetKey: source.key,
        targetTitle: source.title,
        targetStatus: source.status
      };
      if (targetEntry.type === 'BLOCKS') {
        addUniqueLinkSummary(summary.blockedBy, seen.blockedBy, { ...targetEntry, type: 'BLOCKED_BY' });
      } else if (targetEntry.type === 'DUPLICATES') {
        addUniqueLinkSummary(summary.duplicatedBy, seen.duplicatedBy, { ...targetEntry, type: 'DUPLICATED_BY' });
      } else if (targetEntry.type === 'RELATES_TO') {
        addUniqueLinkSummary(summary.relatesTo, seen.relatesTo, { ...targetEntry, type: 'RELATES_TO' });
      } else if (targetEntry.type === 'IS_BLOCKED_BY') {
        addUniqueLinkSummary(summary.blocks, seen.blocks, { ...targetEntry, type: 'BLOCKS' });
      } else if (targetEntry.type === 'IS_DUPLICATED_BY') {
        addUniqueLinkSummary(summary.duplicates, seen.duplicates, { ...targetEntry, type: 'DUPLICATES' });
      }
    });

    const openBlockersCount = summary.blockedBy.filter((b) => {
      if (!b.targetStatus) return true;
      return b.targetStatus !== WorkItemStatus.DONE;
    }).length;

    return {
      ...item,
      linkSummary: { ...summary, openBlockersCount },
      isBlocked: openBlockersCount > 0
    };
  });
};

export const fetchWorkItems = async (filters: any) => {
  try {
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    const query: any = {};
    const andClauses: any[] = [];
    const orClauses: any[] = [];
    let sort: any = { rank: 1, createdAt: -1 };
    let needsBlockedFilter = false;

    if (!filters.includeArchived) {
      andClauses.push({ $or: [{ isArchived: { $exists: false } }, { isArchived: false }] });
    }
    if (filters.bundleId && filters.bundleId !== 'all') {
      const match = await resolveBundleMatch(filters.bundleId);
      if (match) query.bundleId = match;
    }
    if (filters.applicationId && filters.applicationId !== 'all') {
      const match = await resolveApplicationMatch(filters.applicationId);
      if (match) query.applicationId = match;
    }
    if (filters.milestoneId && filters.milestoneId !== 'all') {
      const msRegex = new RegExp(`^${filters.milestoneId}$`, 'i');
      orClauses.push({ milestoneIds: msRegex }, { milestoneId: msRegex });
    }
    if (filters.sprintId && filters.sprintId !== 'all') {
      const match = safeIdMatch(filters.sprintId);
      if (match) query.sprintId = match;
    }
    const pId = filters.parentId || filters.epicId;
    if (pId && pId !== 'all') {
      const match = safeIdMatch(pId);
      if (match) query.parentId = match;
    }
    if (filters.assignedTo && filters.assignedTo !== 'all') {
      query.assignedTo = filters.assignedTo;
    }
    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    }

    if (filters.quickFilter) {
      switch (filters.quickFilter) {
        case 'my': {
          const myClauses: any[] = [];
          if (filters.currentUserId) {
            const match = safeIdMatch(String(filters.currentUserId));
            if (match) myClauses.push({ assigneeUserIds: match });
          }
          const assignedToCandidates = [
            filters.currentUserName,
            filters.currentUsername,
            filters.currentUserEmail,
            filters.currentUser
          ].map((v: any) => (v ? String(v) : '')).filter(Boolean);
          if (assignedToCandidates.length) {
            const regexes = assignedToCandidates.map((v) => new RegExp(`^${escapeRegExp(v)}$`, 'i'));
            myClauses.push({ assignedTo: { $in: regexes } });
          }
          if (myClauses.length) andClauses.push({ $or: myClauses });
          break;
        }
        case 'updated': {
          const recent = new Date();
          recent.setDate(recent.getDate() - 7);
          query.updatedAt = { $gte: recent.toISOString() };
          sort = { updatedAt: -1 };
          break;
        }
        case 'blocked':
          needsBlockedFilter = true;
          break;
      }
    }

    if (filters.q) {
      orClauses.push(
        { title: { $regex: filters.q, $options: 'i' } },
        { key: { $regex: filters.q, $options: 'i' } }
      );
    }
    if (filters.types) {
      const types = String(filters.types).split(',').filter(Boolean);
      if (types.length) andClauses.push({ type: { $in: types } });
    }
    if (filters.priorities) {
      const priorities = String(filters.priorities).split(',').filter(Boolean);
      if (priorities.length) andClauses.push({ priority: { $in: priorities } });
    }
    if (filters.health) {
      const health = String(filters.health).split(',').filter(Boolean);
      if (health.includes('FLAGGED') || health.includes('BLOCKED')) {
        needsBlockedFilter = true;
      }
    }

    if (orClauses.length) andClauses.push({ $or: orClauses });
    if (andClauses.length) query.$and = andClauses;

    let items = await db.collection('workitems').find(query).sort(sort).toArray();
    items = await deriveWorkItemLinkSummary(items);

    if (filters.quickFilter === 'blocked') {
      items = items.filter((item: any) => item.isFlagged || item.status === WorkItemStatus.BLOCKED || item.isBlocked);
    }
    if (needsBlockedFilter && filters.health) {
      const health = String(filters.health).split(',').filter(Boolean);
      if (health.length) {
        items = items.filter((item: any) => {
          const blocked = item.status === WorkItemStatus.BLOCKED || item.isBlocked;
          const flagged = !!item.isFlagged;
          if (health.includes('BLOCKED') && blocked) return true;
          if (health.includes('FLAGGED') && flagged) return true;
          return false;
        });
      }
    }
    if (needsBlockedFilter && !filters.health && filters.quickFilter !== 'blocked') {
      items = items.filter((item: any) => item.isBlocked || item.status === WorkItemStatus.BLOCKED);
    }
    return items;
  } catch {
    return [];
  }
};

export const fetchWorkItemById = async (id: string) => {
  try {
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    const query = ObjectId.isValid(id)
      ? { $or: [{ _id: new ObjectId(id) }, { id }, { key: id }] }
      : { $or: [{ id }, { key: id }] };
    const item = await db.collection('workitems').findOne(query);
    if (!item) return null;
    const [decorated] = await deriveWorkItemLinkSummary([item]);
    return decorated || item;
  } catch {
    return null;
  }
};

export const fetchWorkItemByKeyOrId = async (input: string) => {
  try {
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    const key = String(input).trim();
    if (!key) return null;
    if (ObjectId.isValid(key)) {
      return await db.collection('workitems').findOne({ $or: [{ _id: new ObjectId(key) }, { id: key }, { key }] });
    }
    return await db.collection('workitems').findOne({ $or: [{ key: key.toUpperCase() }, { key }, { id: key }] });
  } catch {
    return null;
  }
};

export const findWorkItemByIdOrKey = async (input: string) => {
  return await fetchWorkItemByKeyOrId(input);
};

export const findWorkItemByDedupKey = async (dedupKey: string) => {
  try {
    if (!dedupKey) return null;
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    return await db.collection('workitems').findOne({ dedupKey });
  } catch {
    return null;
  }
};

export const listRecentAssignedWorkItemsForBundle = async (bundleId: string, itemType: string, limit = 30) => {
  try {
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    return await db.collection('workitems')
      .find(
        { bundleId, type: itemType, assigneeUserIds: { $exists: true, $ne: [] } },
        { projection: { assigneeUserIds: 1, updatedAt: 1 } }
      )
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();
  } catch {
    return [];
  }
};

export const listWorkItemsByMilestoneRefs = async (refs: string[]) => {
  try {
    const refIds = Array.from(new Set(refs.map((ref) => String(ref || '')).filter(Boolean)));
    if (!refIds.length) return [];
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    const objectIds = refIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    return await db.collection('workitems').find({
      $and: [
        { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] },
        {
          $or: [
            { milestoneIds: { $in: refIds } },
            { milestoneIds: { $in: objectIds } },
            { milestoneId: { $in: refIds } },
            { milestoneId: { $in: objectIds } }
          ]
        }
      ]
    }, { projection: { bundleId: 1, storyPoints: 1 } }).toArray();
  } catch {
    return [];
  }
};

export const listWorkItemScopeRecordsByMilestoneRefs = async (refs: string[]) => {
  try {
    const refIds = Array.from(new Set(refs.map((ref) => String(ref || '')).filter(Boolean)));
    if (!refIds.length) return [];
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    const objectIds = refIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    return await db.collection('workitems').find({
      $and: [
        { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] },
        {
          $or: [
            { milestoneIds: { $in: refIds } },
            { milestoneIds: { $in: objectIds } },
            { milestoneId: { $in: refIds } },
            { milestoneId: { $in: objectIds } }
          ]
        }
      ]
    }, {
      projection: { _id: 1, id: 1, key: 1, title: 1, storyPoints: 1, status: 1, bundleId: 1 }
    }).toArray();
  } catch {
    return [];
  }
};

export const listWorkItemRecordsByMilestoneRefs = async (refs: string[]) => {
  try {
    const refIds = Array.from(new Set(refs.map((ref) => String(ref || '')).filter(Boolean)));
    if (!refIds.length) return [];
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    const objectIds = refIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    return await db.collection('workitems').find({
      $and: [
        { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] },
        {
          $or: [
            { milestoneIds: { $in: refIds } },
            { milestoneIds: { $in: objectIds } },
            { milestoneId: { $in: refIds } },
            { milestoneId: { $in: objectIds } }
          ]
        }
      ]
    }).toArray();
  } catch {
    return [];
  }
};

export const listBlockingWorkItemRecordsForTargetRefs = async (refs: string[]) => {
  try {
    const ids = Array.from(new Set(refs.map((ref) => String(ref || '')).filter(Boolean)));
    if (!ids.length) return [];
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    const objectIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    return await db.collection('workitems').find({
      $and: [
        { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] },
        { 'links.type': 'BLOCKS' },
        { 'links.targetId': { $in: [...ids, ...objectIds] } }
      ]
    }).toArray();
  } catch {
    return [];
  }
};

export const listBlockedWorkItemsByMilestoneRefs = async (refs: string[], limit = 3) => {
  try {
    const refIds = Array.from(new Set(refs.map((ref) => String(ref || '')).filter(Boolean)));
    if (!refIds.length) return [];
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    const objectIds = refIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    return await db.collection('workitems').find({
      status: WorkItemStatus.BLOCKED,
      $or: [
        { milestoneIds: { $in: refIds } },
        { milestoneIds: { $in: objectIds } },
        { milestoneId: { $in: refIds } },
        { milestoneId: { $in: objectIds } }
      ]
    }).limit(limit).toArray();
  } catch {
    return [];
  }
};

export const listWorkItemsByAnyRefs = async (refs: string[]) => {
  try {
    const ids = Array.from(new Set(refs.map((ref) => String(ref || '')).filter(Boolean)));
    if (!ids.length) return [];
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    return await db.collection('workitems').find({
      $or: [
        { _id: { $in: ids.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } },
        { id: { $in: ids } },
        { key: { $in: ids } }
      ]
    }).toArray();
  } catch {
    return [];
  }
};

export const listActiveWorkItemsForScope = async (input: {
  bundleIds?: string[];
  milestoneRefs?: string[];
  sprintRefs?: string[];
  projection?: Record<string, unknown>;
}) => {
  try {
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    const query: any = {
      $and: [{ $or: [{ isArchived: { $exists: false } }, { isArchived: false }] }]
    };

    const bundleIds = Array.from(new Set((input.bundleIds || []).map((id) => String(id || '')).filter(Boolean)));
    const milestoneRefs = Array.from(new Set((input.milestoneRefs || []).map((id) => String(id || '')).filter(Boolean)));
    const sprintRefs = Array.from(new Set((input.sprintRefs || []).map((id) => String(id || '')).filter(Boolean)));

    if (milestoneRefs.length) {
      const objectIds = milestoneRefs.filter(ObjectId.isValid).map((id) => new ObjectId(id));
      query.$and.push({
        $or: [
          { milestoneIds: { $in: milestoneRefs } },
          { milestoneIds: { $in: objectIds } },
          { milestoneId: { $in: milestoneRefs } },
          { milestoneId: { $in: objectIds } }
        ]
      });
    } else if (sprintRefs.length) {
      const objectIds = sprintRefs.filter(ObjectId.isValid).map((id) => new ObjectId(id));
      query.$and.push({
        $or: [
          { sprintId: { $in: sprintRefs } },
          { sprintId: { $in: objectIds } }
        ]
      });
    } else if (bundleIds.length) {
      query.bundleId = { $in: bundleIds };
    }

    return await db.collection('workitems').find(
      query,
      input.projection ? { projection: input.projection } : undefined
    ).toArray();
  } catch {
    return [];
  }
};

export const getWorkItemByAnyRef = async (ref: string) => {
  try {
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    const ids = Array.from(new Set([String(ref || '')].filter(Boolean)));
    if (!ids.length) return null;
    return await db.collection('workitems').findOne({
      $or: [
        { _id: { $in: ids.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } },
        { id: { $in: ids } },
        { key: { $in: ids } }
      ]
    });
  } catch {
    return null;
  }
};

export const listBlockingWorkItemsForTargetRefsAndExcludedBundles = async (input: {
  targetRefs: string[];
  excludedBundleIds?: string[];
  projection?: Record<string, unknown>;
}) => {
  try {
    const ids = Array.from(new Set((input.targetRefs || []).map((ref) => String(ref || '')).filter(Boolean)));
    if (!ids.length) return [];
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    const objectIds = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    const query: any = {
      'links.type': 'BLOCKS',
      'links.targetId': { $in: [...ids, ...objectIds] }
    };
    const excludedBundleIds = Array.from(new Set((input.excludedBundleIds || []).map((id) => String(id || '')).filter(Boolean)));
    if (excludedBundleIds.length) {
      query.bundleId = { $nin: excludedBundleIds };
    }
    return await db.collection('workitems').find(
      query,
      input.projection ? { projection: input.projection } : undefined
    ).toArray();
  } catch {
    return [];
  }
};

export const listWorkItemsByIds = async (ids: string[]) => {
  try {
    const normalized = Array.from(new Set(ids.map((id) => String(id || '')).filter(Boolean)));
    const objectIds = normalized.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    if (!objectIds.length) return [];
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    return await db.collection('workitems').find({ _id: { $in: objectIds } }).toArray();
  } catch {
    return [];
  }
};

export const listWorkItemsForScope = async (scope: {
  bundleId?: string | null;
  applicationId?: string | null;
}) => {
  const db = await ensureWorkItemsIndexes();
  await warnLegacyWorkItems(db);
  const query: any = {};
  if (scope.bundleId && scope.bundleId !== 'all') {
    const match = await resolveBundleMatch(scope.bundleId);
    if (match) query.bundleId = match;
  }
  if (scope.applicationId && scope.applicationId !== 'all') {
    const match = await resolveApplicationMatch(scope.applicationId);
    if (match) query.applicationId = match;
  }

  const projection = {
    _id: 1,
    id: 1,
    key: 1,
    title: 1,
    type: 1,
    status: 1,
    priority: 1,
    assignedTo: 1,
    assigneeUserIds: 1,
    isFlagged: 1,
    isBlocked: 1,
    isArchived: 1,
    links: 1,
    parentId: 1,
    bundleId: 1,
    applicationId: 1,
    milestoneId: 1,
    milestoneIds: 1,
    sprintId: 1,
    rank: 1,
    createdAt: 1,
    updatedAt: 1
  };

  return await db.collection('workitems')
    .find(query, { projection })
    .sort({ rank: 1, createdAt: -1 })
    .toArray();
};

export const listDoneWorkItemsByBundleAndSprintIds = async (bundleId: string, sprintIds: string[]) => {
  try {
    const normalizedSprintIds = Array.from(new Set(sprintIds.map((id) => String(id || '')).filter(Boolean)));
    if (!normalizedSprintIds.length) return [];
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    return await db.collection('workitems').find({
      bundleId: String(bundleId),
      sprintId: { $in: normalizedSprintIds },
      status: WorkItemStatus.DONE
    }).toArray();
  } catch {
    return [];
  }
};

export const listDoneWorkItemsByBundleSince = async (bundleId: string, sinceIso: string) => {
  try {
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    return await db.collection('workitems').find({
      bundleId: String(bundleId),
      status: WorkItemStatus.DONE,
      updatedAt: { $gte: sinceIso }
    }).toArray();
  } catch {
    return [];
  }
};

export const listBundleRiskDependencyWorkItems = async (bundleIds: string[]) => {
  try {
    const bundleIdList = Array.from(new Set((bundleIds || []).map(String).filter(Boolean)));
    if (!bundleIdList.length) return [];
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    return await db.collection('workitems').find({
      $and: [
        { type: { $in: ['RISK', 'DEPENDENCY'] } },
        { $or: [{ bundleId: { $in: bundleIdList } }, { 'context.bundleId': { $in: bundleIdList } }] },
        { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] }
      ]
    }).toArray();
  } catch {
    return [];
  }
};

export const listWorkItemMetaByRefs = async (refs: string[]) => {
  try {
    const ids = Array.from(new Set(refs.map((ref) => String(ref || '')).filter(Boolean)));
    if (!ids.length) return [];
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    return await db.collection('workitems').find({
      $or: [
        { _id: { $in: ids.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } },
        { id: { $in: ids } },
        { key: { $in: ids } }
      ]
    }, {
      projection: {
        _id: 1,
        id: 1,
        key: 1,
        title: 1,
        status: 1,
        blocked: 1,
        assignedTo: 1,
        dueAt: 1,
        dueDate: 1,
        bundleId: 1
      }
    }).toArray();
  } catch {
    return [];
  }
};

export const findWorkItemRecord = async (query: Record<string, unknown>, projection?: Record<string, unknown>) => {
  try {
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    return await db.collection('workitems').findOne(query, projection ? { projection } : undefined);
  } catch {
    return null;
  }
};

export const findWorkItemByReviewRefs = async (input: {
  reviewId?: string;
  cycleId?: string;
  projection?: Record<string, unknown>;
}) => {
  try {
    const reviewId = input.reviewId ? String(input.reviewId) : '';
    const cycleId = input.cycleId ? String(input.cycleId) : '';
    if (!reviewId && !cycleId) return null;
    const orClauses: any[] = [];
    if (cycleId) {
      orClauses.push({ reviewCycleId: cycleId });
      if (reviewId) {
        orClauses.push(
          { dedupKey: `reviews.cycle.requested:${reviewId}:${cycleId}` },
          { dedupKey: `reviews.cycle.resubmitted:${reviewId}:${cycleId}` }
        );
      }
    }
    if (reviewId) {
      orClauses.push({ reviewId });
      if (ObjectId.isValid(reviewId)) {
        orClauses.push({ reviewId: new ObjectId(reviewId) });
      }
    }
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    return await db.collection('workitems').findOne(
      { $or: orClauses },
      input.projection ? { projection: input.projection } : undefined
    );
  } catch {
    return null;
  }
};

export const archiveWorkItemRecord = async (id: string, archivedBy: string) => {
  const db = await ensureWorkItemsIndexes();
  await warnLegacyWorkItems(db);
  const now = new Date().toISOString();
  const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : resolveWorkItemFilter(id);
  await db.collection('workitems').updateOne(
    filter as any,
    { $set: { isArchived: true, archivedAt: now, archivedBy, updatedAt: now } }
  );
  return { success: true, now };
};

export const restoreWorkItemRecord = async (id: string) => {
  const db = await ensureWorkItemsIndexes();
  await warnLegacyWorkItems(db);
  const now = new Date().toISOString();
  const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : resolveWorkItemFilter(id);
  await db.collection('workitems').updateOne(
    filter as any,
    { $set: { isArchived: false, updatedAt: now }, $unset: { archivedAt: '', archivedBy: '' } }
  );
  return { success: true, now };
};

export const updateWorkItemsMilestoneAssignment = async (input: {
  workItemRefs: string[];
  milestoneId: string;
  action: 'ADD_ITEMS' | 'REMOVE_ITEMS';
  updatedAt: string;
}) => {
  const db = await ensureWorkItemsIndexes();
  await warnLegacyWorkItems(db);
  const workItemRefs = Array.from(new Set((input.workItemRefs || []).map((id) => String(id || '')).filter(Boolean)));
  if (!workItemRefs.length) return { matchedCount: 0, modifiedCount: 0 };
  const objectIds = workItemRefs.filter(ObjectId.isValid).map((id) => new ObjectId(id));
  const filter = {
    $or: [
      { _id: { $in: objectIds } },
      { id: { $in: workItemRefs } },
      { key: { $in: workItemRefs } }
    ]
  };
  if (input.action === 'ADD_ITEMS') {
    return await db.collection('workitems').updateMany(
      filter,
      { $addToSet: { milestoneIds: String(input.milestoneId) }, $set: { updatedAt: input.updatedAt } }
    );
  }
  return await db.collection('workitems').updateMany(
    filter,
    { $pull: { milestoneIds: String(input.milestoneId) }, $set: { updatedAt: input.updatedAt }, $unset: { milestoneId: '' } } as any
  );
};

export const appendWorkItemActivityRecord = async (id: string, activity: Record<string, unknown>) => {
  const db = await ensureWorkItemsIndexes();
  await warnLegacyWorkItems(db);
  const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : resolveWorkItemFilter(id);
  return await db.collection('workitems').updateOne(
    filter as any,
    { $push: { activity }, $set: { updatedAt: new Date().toISOString() } } as any
  );
};

export const listUnassignedWorkItemCandidates = async (limit = 10) => {
  const db = await ensureWorkItemsIndexes();
  await warnLegacyWorkItems(db);
  return await db.collection('workitems')
    .find({
      $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }, { assignedTo: '' }],
      status: { $nin: ['DONE'] }
    })
    .limit(limit)
    .project({ _id: 1, title: 1, activity: 1 })
    .toArray();
};

export const bulkAssignWorkItems = async (ids: ObjectId[], assignee: string, actorName: string) => {
  if (!ids.length) return;
  const db = await ensureWorkItemsIndexes();
  await warnLegacyWorkItems(db);
  const now = new Date().toISOString();
  await db.collection('workitems').updateMany(
    { _id: { $in: ids } },
    {
      $set: { assignedTo: assignee, updatedAt: now, updatedBy: actorName },
      $push: {
        activity: {
          user: actorName,
          action: 'AUTO_ASSIGNED',
          field: 'assignedTo',
          to: assignee,
          createdAt: now
        }
      }
    } as any
  );
};

export const bulkFlagWorkItems = async (ids: ObjectId[], actorName: string) => {
  if (!ids.length) return;
  const db = await ensureWorkItemsIndexes();
  await warnLegacyWorkItems(db);
  const now = new Date().toISOString();
  await db.collection('workitems').updateMany(
    { _id: { $in: ids } },
    {
      $set: { isFlagged: true, updatedAt: now, updatedBy: actorName },
      $push: {
        activity: {
          user: actorName,
          action: 'AUTO_FLAGGED',
          field: 'isFlagged',
          to: true,
          createdAt: now
        }
      }
    } as any
  );
};

export const bulkPatchWorkItemsByIds = async (input: {
  ids: string[];
  set: Record<string, unknown>;
  activity: Record<string, unknown>;
}) => {
  const db = await ensureWorkItemsIndexes();
  await warnLegacyWorkItems(db);
  const objectIds = Array.from(new Set((input.ids || []).filter(ObjectId.isValid))).map((id) => new ObjectId(id));
  if (!objectIds.length) return { matchedCount: 0, modifiedCount: 0 };
  return await db.collection('workitems').updateMany(
    { _id: { $in: objectIds } },
    {
      $set: input.set,
      $push: { activity: input.activity }
    } as any
  );
};

export const listQualityIssueWorkItems = async (input: {
  milestoneId?: string | null;
  sprintId?: string | null;
  issue: 'missingStoryPoints' | 'missingDueAt' | 'missingRiskSeverity';
  limit?: number;
}) => {
  try {
    const db = await ensureWorkItemsIndexes();
    await warnLegacyWorkItems(db);
    const query: any = {
      $and: [
        { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] },
        { status: { $ne: 'DONE' } }
      ]
    };

    if (input.milestoneId) {
      const msId = String(input.milestoneId);
      const msObjectIds = ObjectId.isValid(msId) ? [new ObjectId(msId)] : [];
      query.$and.push({
        $or: [
          { milestoneIds: { $in: [msId, ...msObjectIds] } },
          { milestoneId: { $in: [msId, ...msObjectIds] } }
        ]
      });
    }

    if (input.sprintId) {
      const spId = String(input.sprintId);
      const spObjectIds = ObjectId.isValid(spId) ? [new ObjectId(spId)] : [];
      query.$and.push({ sprintId: { $in: [spId, ...spObjectIds] } });
    }

    if (input.issue === 'missingStoryPoints') {
      query.$and.push({ $or: [{ storyPoints: { $exists: false } }, { storyPoints: null }] });
    }
    if (input.issue === 'missingDueAt') {
      query.$and.push({ $or: [{ dueAt: { $exists: false } }, { dueAt: null }, { dueAt: '' }] });
    }
    if (input.issue === 'missingRiskSeverity') {
      query.$and.push({ type: 'RISK' });
      query.$and.push({
        $or: [
          { 'risk.severity': { $exists: false } },
          { 'risk.severity': null },
          { 'risk.severity': '' }
        ]
      });
    }

    return await db.collection('workitems')
      .find(query)
      .project({ _id: 1, id: 1, key: 1, title: 1, status: 1, storyPoints: 1, dueAt: 1, assignedTo: 1, risk: 1, type: 1 })
      .limit(Math.min(Math.max(input.limit || 200, 1), 500))
      .toArray();
  } catch {
    return [];
  }
};

export const detectBlocksCycle = async (sourceId: string, targetId: string) => {
  if (!sourceId || !targetId) return false;
  if (sourceId === targetId) return true;
  const db = await ensureWorkItemsIndexes();
  await warnLegacyWorkItems(db);

  const visited = new Set<string>();
  const queue: string[] = [targetId];

  const fetchOutgoingBlocks = async (nodeId: string) => {
    const idCandidates = collectWorkItemIdCandidates([nodeId]);
    const node = await db.collection('workitems')
      .findOne(resolveWorkItemFilter(nodeId), { projection: { links: 1 } });
    const directTargets = new Set<string>();
    (node?.links || []).forEach((link: any) => {
      if (!link?.targetId || !link?.type) return;
      if (String(link.type) === 'BLOCKS') directTargets.add(String(link.targetId));
    });

    const legacyBlocks = await db.collection('workitems')
      .find({ 'links.type': 'IS_BLOCKED_BY', 'links.targetId': { $in: idCandidates } }, { projection: { _id: 1, id: 1 } })
      .toArray();
    legacyBlocks.forEach((node) => {
      const nodeIdStr = normalizeWorkItemId(node);
      if (nodeIdStr) directTargets.add(nodeIdStr);
    });

    return Array.from(directTargets);
  };

  while (queue.length) {
    const current = queue.shift() as string;
    if (visited.has(current)) continue;
    visited.add(current);
    const nextTargets = await fetchOutgoingBlocks(current);
    for (const next of nextTargets) {
      if (next === sourceId) return true;
      if (!visited.has(next)) queue.push(next);
    }
  }

  return false;
};

export const addWorkItemLinkRecord = async (
  sourceId: string,
  targetId: string,
  type: string,
  userName: string
) => {
  const db = await ensureWorkItemsIndexes();
  await warnLegacyWorkItems(db);
  const now = new Date().toISOString();

  const source = await db.collection('workitems').findOne(resolveWorkItemFilter(sourceId));
  if (!source) throw new Error('Source work item not found');

  const target = await db.collection('workitems').findOne(resolveWorkItemFilter(targetId));
  if (!target) throw new Error('Target work item not found');

  const existingLinks = source.links || [];
  const exists = existingLinks.some((link: any) => String(link.targetId) === String(target._id || target.id || targetId) && String(link.type) === type);
  if (exists) return { ok: true, duplicate: true };

  const link = {
    type,
    targetId: String(target._id || target.id || targetId),
    targetKey: target.key,
    targetTitle: target.title
  };

  await db.collection('workitems').updateOne(
    resolveWorkItemFilter(sourceId),
    {
      $addToSet: { links: link },
      $set: { updatedAt: now },
      $push: { activity: { user: userName, action: 'LINK_ADDED', field: 'links', to: `${type}:${target.key || targetId}`, createdAt: now } }
    } as any
  );

  return { ok: true };
};

export const removeWorkItemLinkRecord = async (
  sourceId: string,
  targetId: string,
  type: string,
  userName: string
) => {
  const db = await ensureWorkItemsIndexes();
  await warnLegacyWorkItems(db);
  const now = new Date().toISOString();
  await db.collection('workitems').updateOne(
    resolveWorkItemFilter(sourceId),
    {
      $pull: { links: { targetId: String(targetId), type } },
      $set: { updatedAt: now },
      $push: { activity: { user: userName, action: 'LINK_REMOVED', field: 'links', to: `${type}:${targetId}`, createdAt: now } }
    } as any
  );
  return { ok: true };
};

const normalizeWorkItemRanks = async (
  db: any,
  scope: { status?: string; bundleId?: string; applicationId?: string; sprintId?: string }
) => {
  const query: any = {};
  if (scope.status) query.status = scope.status;
  if (scope.bundleId) query.bundleId = scope.bundleId;
  if (scope.applicationId) query.applicationId = scope.applicationId;
  if (scope.sprintId !== undefined) query.sprintId = scope.sprintId;

  const items = await db
    .collection('workitems')
    .find(query)
    .sort({ rank: 1, createdAt: -1 })
    .limit(1000)
    .toArray();

  if (items.length < 2) return;

  let needsNormalize = false;
  let lastRank = 0;
  for (const item of items) {
    const rank = typeof item.rank === 'number' ? item.rank : 0;
    if (!rank) {
      needsNormalize = true;
      break;
    }
    if (rank <= lastRank || rank - lastRank < 2) {
      needsNormalize = true;
      break;
    }
    lastRank = rank;
  }

  if (lastRank > 1_000_000_000) needsNormalize = true;
  if (!needsNormalize) return;

  const bulk = items.map((item: any, idx: number) => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $set: { rank: (idx + 1) * 1000 } }
    }
  }));

  await db.collection('workitems').bulkWrite(bulk, { ordered: false });
};

const computeRiskSeverity = (risk?: any) => {
  if (!risk?.probability || !risk?.impact) return undefined;
  const score = Number(risk.probability) * Number(risk.impact);
  if (score <= 4) return 'low';
  if (score <= 9) return 'medium';
  if (score <= 16) return 'high';
  return 'critical';
};

const normalizeWorkItemPayload = (input: any, existing?: any) => {
  const data = { ...input };

  if (data.type === WorkItemType.RISK && data.risk) {
    data.risk = { ...data.risk, severity: computeRiskSeverity(data.risk) };
  }
  if (data.storyPoints !== undefined) {
    const points = Number(data.storyPoints);
    if (Number.isNaN(points) || points < 0) {
      throw new Error('storyPoints must be a non-negative number');
    }
  }
  if (data.timeEstimateHours !== undefined) {
    const hours = Number(data.timeEstimateHours);
    if (Number.isNaN(hours) || hours < 0) {
      throw new Error('timeEstimateHours must be a non-negative number');
    }
  }
  if (data.type === WorkItemType.DEPENDENCY) {
    data.dependency = { ...(data.dependency || {}), blocking: data.dependency?.blocking !== false };
  }
  if (!data.context && (data.bundleId || existing?.bundleId)) {
    data.context = {
      bundleId: String(data.bundleId || existing.bundleId),
      appId: data.applicationId
        ? String(data.applicationId)
        : (existing?.applicationId ? String(existing.applicationId) : undefined)
    };
  }

  return data;
};

export const saveWorkItemRecord = async (
  item: Record<string, unknown>,
  userName: string
) => {
  const db = await ensureWorkItemsIndexes();
  await warnLegacyWorkItems(db);
  const { _id, ...rawData } = item as any;
  const now = new Date().toISOString();

  if (_id && ObjectId.isValid(String(_id))) {
    const existing = await db.collection('workitems').findOne({ _id: new ObjectId(String(_id)) });
    if (!existing) throw new Error('Work item not found');

    const data = normalizeWorkItemPayload(rawData, existing);
    const activities: any[] = [];
    const fieldsToTrack = ['status', 'priority', 'assignedTo', 'title', 'description', 'storyPoints', 'parentId', 'milestoneIds', 'timeEstimate', 'timeLogged', 'isFlagged', 'attachments', 'links', 'aiWorkPlan', 'checklists', 'isArchived'];

    fieldsToTrack.forEach((field) => {
      const oldVal = existing[field];
      const newVal = data[field];
      if (newVal !== undefined && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        activities.push({
          user: userName,
          action: field === 'checklists'
            ? 'CHECKLIST_UPDATED'
            : field === 'isFlagged'
              ? (newVal ? 'IMPEDIMENT_RAISED' : 'IMPEDIMENT_CLEARED')
              : field === 'timeLogged'
                ? 'WORK_LOGGED'
                : field === 'aiWorkPlan'
                  ? 'AI_REFINEMENT_COMMITTED'
                  : (field === 'status' ? 'CHANGED_STATUS' : 'UPDATED_FIELD'),
          field,
          from: oldVal,
          to: newVal,
          createdAt: now
        });
      }
    });

    if (data.status !== undefined && data.status !== existing.status) {
      const nextStatus = String(data.status).toUpperCase();
      if (nextStatus === 'DONE') {
        if (!data.completedAt) data.completedAt = now;
      } else if (existing.completedAt && data.completedAt === undefined) {
        data.completedAt = null;
      }
    }

    const finalSet = { ...data, updatedAt: now, updatedBy: userName };
    const finalPush = { activity: { $each: activities } };
    const result = await db.collection('workitems').updateOne(
      { _id: new ObjectId(String(_id)) },
      { $set: finalSet, $push: finalPush } as any
    );

    if (data.rank !== undefined) {
      try {
        await normalizeWorkItemRanks(db, {
          status: String(data.status || existing.status || ''),
          bundleId: String(data.bundleId || existing.bundleId || ''),
          applicationId: String(data.applicationId || existing.applicationId || ''),
          sprintId: data.sprintId !== undefined ? String(data.sprintId || '') : existing.sprintId
        });
      } catch {
        // Best-effort rank normalization only.
      }
    }

    return { mode: 'update' as const, existing, result, activities, now, finalSet };
  }

  const data = normalizeWorkItemPayload(rawData);
  let key = data.key;
  if (!key) {
    const bundle = await db.collection('bundles').findOne(
      data.bundleId && ObjectId.isValid(String(data.bundleId))
        ? { _id: new ObjectId(String(data.bundleId)) }
        : { key: data.bundleId }
    );
    const prefix = bundle?.key || 'TASK';
    const count = await db.collection('workitems').countDocuments({ bundleId: data.bundleId });
    key = `${prefix}-${count + 1}`;
  }

  if (data.status && String(data.status).toUpperCase() === 'DONE' && !data.completedAt) {
    data.completedAt = now;
  }

  const newItem = {
    ...data,
    key,
    createdAt: now,
    updatedAt: now,
    createdBy: userName,
    activity: [{ user: userName, action: 'CREATED', createdAt: now }]
  };
  const result = await db.collection('workitems').insertOne(newItem);
  return { mode: 'create' as const, result, newItem, now };
};

export const updateWorkItemStatusRecord = async (
  id: string,
  toStatus: string,
  newRank: number,
  userName: string
) => {
  const db = await ensureWorkItemsIndexes();
  await warnLegacyWorkItems(db);
  const now = new Date().toISOString();

  const existing = await db.collection('workitems').findOne({ _id: new ObjectId(id) });
  if (!existing) return null;

  const nextStatus = String(toStatus || '').toUpperCase();
  const statusUpdate: any = { status: toStatus, rank: newRank, updatedAt: now };
  if (nextStatus === 'DONE') {
    if (!existing.completedAt) statusUpdate.completedAt = now;
  } else if (existing.completedAt) {
    statusUpdate.completedAt = null;
  }

  const result = await db.collection('workitems').updateOne(
    { _id: new ObjectId(id) },
    {
      $set: statusUpdate,
      $push: {
        activity: {
          user: userName,
          action: 'CHANGED_STATUS',
          from: existing.status,
          to: toStatus,
          createdAt: now
        }
      }
    } as any
  );

  try {
    await normalizeWorkItemRanks(db, {
      status: toStatus,
      bundleId: existing.bundleId,
      applicationId: existing.applicationId,
      sprintId: existing.sprintId
    });
  } catch {
    // Best-effort rank normalization only.
  }

  return { existing, result, now, statusUpdate };
};

export const updateWorkItemRecordById = async (id: string, input: {
  set?: Record<string, unknown>;
  unset?: Record<string, unknown>;
  activityEntry?: Record<string, unknown>;
}) => {
  const db = await ensureWorkItemsIndexes();
  await warnLegacyWorkItems(db);
  const now = new Date().toISOString();
  const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : resolveWorkItemFilter(id);
  const existing = await db.collection('workitems').findOne(filter as any);
  if (!existing) return null;

  const update: any = {
    $set: {
      ...(input.set || {}),
      updatedAt: input.set?.updatedAt || now
    }
  };
  if (input.unset && Object.keys(input.unset).length) update.$unset = input.unset;
  if (input.activityEntry) update.$push = { activity: input.activityEntry };

  const result = await db.collection('workitems').updateOne(filter as any, update);
  return { existing, result, now };
};

export const fetchWorkItemsBoard = async (filters: any) => {
  const items = await fetchWorkItems(filters);
  const statuses = [
    { id: WorkItemStatus.TODO, name: 'To Do' },
    { id: WorkItemStatus.IN_PROGRESS, name: 'In Progress' },
    { id: WorkItemStatus.REVIEW, name: 'Review' },
    { id: WorkItemStatus.DONE, name: 'Done' },
    { id: WorkItemStatus.BLOCKED, name: 'Blocked' }
  ];
  return {
    columns: statuses.map((s) => ({
      statusId: s.id,
      statusName: s.name,
      items: items.filter((i) => i.status === s.id)
    }))
  };
};

export const fetchWorkItemTree = async (filters: any) => {
  let items = await fetchWorkItems(filters);
  const treeMode = filters.treeMode || 'hierarchy';

  if (treeMode === 'milestone') {
    const milestones = await listMilestones(filters || {});
    return milestones.map((m: any) => {
      const mIdStr = m._id?.toString();
      const mItems = items.filter((i) => {
        const ids = i.milestoneIds || [];
        const id = (i as any).milestoneId;
        return ids.includes(mIdStr) || id === mIdStr || id === m.name;
      });
      return {
        id: `ms-node-${mIdStr}`,
        label: m.name,
        type: 'MILESTONE',
        status: m.status,
        bundleId: m.bundleId,
        children: mItems.map((i) => ({
          id: i._id?.toString() || i.id,
          key: i.key,
          label: i.title,
          type: i.type,
          status: i.status,
          isFlagged: i.isFlagged,
          links: i.links || [],
          linkSummary: i.linkSummary,
          isBlocked: i.isBlocked,
          bundleId: i.bundleId,
          workItemId: i._id?.toString() || i.id,
          nodeType: 'WORK_ITEM',
          children: []
        }))
      };
    });
  }

  if (filters.quickFilter === 'my' && items.length > 0) {
    const byId = new Map<string, any>();
    items.forEach((item) => {
      const id = String(item._id || item.id || '');
      if (id) byId.set(id, item);
    });
    for (const item of [...items]) {
      let parentId = item.parentId ? String(item.parentId) : '';
      while (parentId) {
        if (byId.has(parentId)) break;
        const parent = await fetchWorkItemById(parentId);
        if (!parent) break;
        const parentKey = String(parent._id || parent.id || '');
        if (parentKey) {
          byId.set(parentKey, parent);
          items.push(parent);
        }
        parentId = parent.parentId ? String(parent.parentId) : '';
      }
    }
  }

  const buildTree = (parentId: any = null): any[] => {
    return items
      .filter((item) => {
        const itemPid = item.parentId?.toString() || null;
        const comparePid = parentId?.toString() || null;
        if (comparePid === null) return itemPid === null || itemPid === '';
        return itemPid === comparePid;
      })
      .map((item) => {
        const children = buildTree(item._id || item.id);
        let completion = 0;
        if (children.length > 0) {
          const done = children.filter((c) => c.status === WorkItemStatus.DONE).length;
          completion = Math.round((done / children.length) * 100);
        }
        return {
          id: item._id?.toString() || item.id,
          key: item.key,
          label: item.title,
          type: item.type,
          status: item.status,
          isFlagged: item.isFlagged,
          links: item.links || [],
          linkSummary: item.linkSummary,
          isBlocked: item.isBlocked,
          bundleId: item.bundleId,
          workItemId: item._id?.toString() || item.id,
          nodeType: 'WORK_ITEM',
          completion,
          children
        };
      });
  };

  return buildTree();
};
