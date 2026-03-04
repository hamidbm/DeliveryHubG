import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getDb } from './db';
import { isAdminOrCmo } from './authz';
import type { WorkItem, Bundle } from '../types';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

type AuthUser = {
  userId?: string;
  id?: string;
  role?: string;
  email?: string;
};

type VisibilityLevel = 'PRIVATE' | 'INTERNAL' | 'PUBLIC';

const normalizeUserId = (user?: AuthUser | null) => String(user?.userId || user?.id || '');

const buildIdCandidates = (value: string) => {
  const candidates: Array<string | ObjectId> = [value];
  if (ObjectId.isValid(value)) candidates.push(new ObjectId(value));
  return candidates;
};

const ensureBundleVisibilityIndexes = async (db: any) => {
  await db.collection('bundles').createIndex({ visibility: 1 });
};

export const getAuthUserFromCookies = async (): Promise<AuthUser | null> => {
  const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
  if (testToken) {
    const { payload } = await jwtVerify(testToken, JWT_SECRET);
    return {
      userId: String((payload as any).id || (payload as any).userId || ''),
      role: (payload as any).role ? String((payload as any).role) : undefined,
      email: (payload as any).email ? String((payload as any).email) : undefined
    };
  }
  const cookieStore = await cookies();
  const token = cookieStore?.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String((payload as any).id || (payload as any).userId || ''),
    role: (payload as any).role ? String((payload as any).role) : undefined,
    email: (payload as any).email ? String((payload as any).email) : undefined
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
    const db = await getDb();
    await ensureBundleVisibilityIndexes(db);
    const candidates = buildIdCandidates(id);
    const bundle = await db.collection('bundles').findOne({
      $or: [
        { _id: { $in: candidates.filter((c) => c instanceof ObjectId) } },
        { id: { $in: candidates.filter((c) => typeof c === 'string') as string[] } },
        { key: { $in: candidates.filter((c) => typeof c === 'string') as string[] } }
      ]
    });
    bundleCache.set(id, bundle || null);
    return bundle || null;
  };

  const resolveBundleOwners = async (bundleId: string) => {
    if (bundleOwnerCache.has(bundleId)) return bundleOwnerCache.get(bundleId) as Set<string>;
    const db = await getDb();
    const assignments = await db.collection('bundle_assignments').find({
      bundleId: String(bundleId),
      assignmentType: 'bundle_owner',
      active: true
    }).toArray();
    const owners = new Set(assignments.map((a: any) => String(a.userId || '')).filter(Boolean));
    bundleOwnerCache.set(bundleId, owners);
    return owners;
  };

  const resolveBundleWatchers = async (bundleId: string) => {
    if (bundleWatcherCache.has(bundleId)) return bundleWatcherCache.get(bundleId) as Set<string>;
    const db = await getDb();
    const watchers = await db.collection('notification_watchers').find({
      scopeType: 'BUNDLE',
      scopeId: String(bundleId)
    }).toArray();
    const ids = new Set(watchers.map((w: any) => String(w.userId || '')).filter(Boolean));
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
    const db = await getDb();
    const candidates = buildIdCandidates(id);
    const milestone = await db.collection('milestones').findOne({
      $or: [
        { _id: { $in: candidates.filter((c) => c instanceof ObjectId) } },
        { id: { $in: candidates.filter((c) => typeof c === 'string') as string[] } },
        { name: { $in: candidates.filter((c) => typeof c === 'string') as string[] } }
      ]
    }, { projection: { bundleId: 1 } });
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
    const ids = Array.from(targetIds);
    const objectIds = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    const db = await getDb();
    const targets = await db.collection('workitems')
      .find({
        $or: [
          { _id: { $in: objectIds } },
          { id: { $in: ids } },
          { key: { $in: ids } }
        ]
      }, { projection: { _id: 1, id: 1, key: 1, bundleId: 1 } })
      .toArray();

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
