import { ObjectId } from 'mongodb';
import { isAdminOrCmo } from './authz';
import { resolveCurrentPrincipal } from '../shared/auth/principal';
import type { WorkItem, Bundle } from '../types';
import { findBundleByAnyId } from '../server/db/repositories/bundlesRepo';
import { listBundleAssignments } from '../server/db/repositories/bundleAssignmentsRepo';
import { getMilestoneByRef } from '../server/db/repositories/milestonesRepo';
import { listWatcherUserIdsForScopeRecord } from '../server/db/repositories/watchersRepo';
import { listWorkItemMetaByRefs } from '../server/db/repositories/workItemsRepo';

type AuthUser = {
  userId?: string;
  id?: string;
  role?: string;
  email?: string;
  accountType?: 'STANDARD' | 'GUEST';
};

type VisibilityLevel = 'PRIVATE' | 'INTERNAL' | 'PUBLIC';

const normalizeUserId = (user?: AuthUser | null) => String(user?.userId || user?.id || '');

const buildIdCandidates = (value: string) => {
  const candidates: Array<string | ObjectId> = [value];
  if (ObjectId.isValid(value)) candidates.push(new ObjectId(value));
  return candidates;
};

export const getAuthUserFromCookies = async (): Promise<AuthUser | null> => {
  const principal = await resolveCurrentPrincipal();
  if (!principal) return null;
  return {
    userId: principal.userId,
    role: principal.role || undefined,
    email: principal.email,
    accountType: principal.accountType
  };
};

export const createVisibilityContext = (user: AuthUser | null) => {
  const bundleCache = new Map<string, any | null>();
  const bundleOwnerCache = new Map<string, Set<string>>();
  const bundleWatcherCache = new Map<string, Set<string>>();
  const milestoneBundleCache = new Map<string, string | null>();

  const resolveBundle = async (bundleId?: string | null) => {
    const id = String(bundleId || '');
    if (!id) return null;
    if (bundleCache.has(id)) return bundleCache.get(id) || null;
    const bundle = await findBundleByAnyId(id);
    bundleCache.set(id, bundle || null);
    return bundle || null;
  };

  const resolveBundleOwners = async (bundleId: string) => {
    if (bundleOwnerCache.has(bundleId)) return bundleOwnerCache.get(bundleId) as Set<string>;
    const assignments = await listBundleAssignments({
      bundleId: String(bundleId),
      assignmentType: 'bundle_owner',
      active: true
    });
    const owners = new Set(assignments.map((a: any) => String(a.userId || '')).filter(Boolean));
    bundleOwnerCache.set(bundleId, owners);
    return owners;
  };

  const resolveBundleWatchers = async (bundleId: string) => {
    if (bundleWatcherCache.has(bundleId)) return bundleWatcherCache.get(bundleId) as Set<string>;
    const watcherIds = await listWatcherUserIdsForScopeRecord('BUNDLE', String(bundleId));
    const ids = new Set(watcherIds.map(String).filter(Boolean));
    bundleWatcherCache.set(bundleId, ids);
    return ids;
  };

  const canViewBundle = async (bundleId?: string | null) => {
    if (!user || !normalizeUserId(user)) return false;
    if (!bundleId) return true;
    if (await isAdminOrCmo(user)) return true;
    const bundle = await resolveBundle(bundleId);
    const visibility: VisibilityLevel = (bundle?.visibility as VisibilityLevel) || 'INTERNAL';
    if (visibility !== 'PRIVATE') return true;
    const userId = normalizeUserId(user);
    const owners = await resolveBundleOwners(String(bundleId));
    if (owners.has(userId)) return true;
    const watchers = await resolveBundleWatchers(String(bundleId));
    return watchers.has(userId);
  };

  const canViewWorkItem = async (item?: Partial<WorkItem> | null) => {
    if (!item) return false;
    const bundleId = item.bundleId ? String(item.bundleId) : '';
    if (!bundleId) return Boolean(user && normalizeUserId(user));
    return await canViewBundle(bundleId);
  };

  const filterVisibleWorkItems = async <T extends Partial<WorkItem>>(items: T[]) => {
    if (!items.length) return [];
    const bundleIds = Array.from(new Set(items.map((i) => String(i.bundleId || '')).filter(Boolean)));
    const visibilityMap = new Map<string, boolean>();
    await Promise.all(bundleIds.map(async (id) => {
      visibilityMap.set(id, await canViewBundle(id));
    }));
    return items.filter((item) => {
      if (!item.bundleId) return Boolean(user && normalizeUserId(user));
      return visibilityMap.get(String(item.bundleId)) !== false;
    });
  };

  const resolveMilestoneBundle = async (milestoneId?: string | null) => {
    const id = String(milestoneId || '');
    if (!id) return null;
    if (milestoneBundleCache.has(id)) return milestoneBundleCache.get(id) || null;
    const milestone = await getMilestoneByRef(id);
    const bundleId = milestone?.bundleId ? String(milestone.bundleId) : null;
    milestoneBundleCache.set(id, bundleId);
    return bundleId;
  };

  const canViewMilestone = async (milestoneId?: string | null) => {
    if (!milestoneId) return false;
    const bundleId = await resolveMilestoneBundle(milestoneId);
    if (!bundleId) return Boolean(user && normalizeUserId(user));
    return await canViewBundle(bundleId);
  };

  const filterVisibleMilestoneIds = async (milestoneIds: string[]) => {
    const visible: string[] = [];
    for (const id of milestoneIds) {
      if (await canViewMilestone(id)) visible.push(id);
    }
    return visible;
  };

  const redactWorkItemLinks = async <T extends Partial<WorkItem>>(items: T[]) => {
    if (!items.length) return items;
    const targetIds = new Set<string>();
    items.forEach((item) => {
      const summary: any = (item as any).linkSummary;
      if (!summary) return;
      ['blocks', 'blockedBy', 'duplicates', 'duplicatedBy', 'relatesTo'].forEach((key) => {
        (summary[key] || []).forEach((entry: any) => {
          if (entry?.targetId) targetIds.add(String(entry.targetId));
        });
      });
    });
    if (!targetIds.size) return items;
    const targets = await listWorkItemMetaByRefs(Array.from(targetIds));

    const visibilityMap = new Map<string, boolean>();
    await Promise.all(targets.map(async (t: any) => {
      const bundleId = t.bundleId ? String(t.bundleId) : '';
      const visible = bundleId ? await canViewBundle(bundleId) : Boolean(user && normalizeUserId(user));
      const identifiers = [t._id, t.id, t.key].map((v) => (v ? String(v) : '')).filter(Boolean);
      identifiers.forEach((id) => visibilityMap.set(id, visible));
    }));

    items.forEach((item) => {
      const summary: any = (item as any).linkSummary;
      if (!summary) return;
      ['blocks', 'blockedBy', 'duplicates', 'duplicatedBy', 'relatesTo'].forEach((key) => {
        summary[key] = (summary[key] || []).map((entry: any) => {
          if (!entry?.targetId) return entry;
          const visible = visibilityMap.get(String(entry.targetId));
          if (visible === false) {
            return {
              ...entry,
              targetTitle: 'Restricted item',
              restricted: true
            };
          }
          return entry;
        });
      });
    });

    return items;
  };

  const redactWorkItem = async (item?: Partial<WorkItem> | null) => {
    if (!item) return item;
    const visible = await canViewWorkItem(item);
    if (!visible) {
      return {
        _id: item._id,
        id: item.id,
        key: item.key,
        type: item.type,
        status: item.status,
        title: 'Restricted item',
        restricted: true
      } as Partial<WorkItem>;
    }
    return item;
  };

  const filterVisibleEventsForFeed = async (events: any[]) => {
    if (!events.length) return [];
    const filtered: any[] = [];
    for (const event of events) {
      const bundleId = event?.context?.bundleId || event?.payload?.bundleId || null;
      if (bundleId) {
        if (await canViewBundle(String(bundleId))) {
          filtered.push(event);
        }
        continue;
      }
      const milestoneId = event?.context?.milestoneId || event?.payload?.milestoneId || (event?.resource?.type?.startsWith('milestones') ? event?.resource?.id : null);
      if (milestoneId) {
        if (await canViewMilestone(String(milestoneId))) {
          filtered.push(event);
        }
        continue;
      }
      filtered.push(event);
    }
    return filtered;
  };

  const filterVisibleBundles = async <T extends Bundle>(bundles: T[]) => {
    if (!bundles.length) return [];
    const next: T[] = [];
    for (const bundle of bundles) {
      const canView = await canViewBundle(String(bundle._id || bundle.id || bundle.key || ''));
      if (canView) next.push(bundle);
    }
    return next;
  };

  return {
    canViewBundle,
    canViewWorkItem,
    filterVisibleWorkItems,
    redactWorkItem,
    redactWorkItemLinks,
    canViewMilestone,
    filterVisibleMilestoneIds,
    filterVisibleEventsForFeed,
    filterVisibleBundles
  };
};
