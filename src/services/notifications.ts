import { listAdmins } from '../server/db/repositories/adminsRepo';
import { listBundleAssignments } from '../server/db/repositories/bundleAssignmentsRepo';
import {
  enqueueNotificationDigestItems,
  getNotificationSettingsDoc,
  getUserNotificationPrefsDoc,
  insertClassicNotifications,
  listUserNotificationPrefsDocs,
  saveNotificationSettingsDoc,
  saveUserNotificationPrefsDoc
} from '../server/db/repositories/notificationPlatformRepo';
import { listUsersByAnyIds, resolveUsersForMentions, searchUsersWithFilters } from '../server/db/repositories/usersRepo';
import { listWatcherUserIdsForScopes } from './watchers';
import { createVisibilityContext } from './visibility';

const DEFAULT_NOTIFICATION_TYPES = [
  'milestone.status.changed',
  'milestone.status.override',
  'milestone.readiness.blocked',
  'milestone.capacity.override',
  'milestone.scope.requested',
  'milestone.scope.approved',
  'milestone.scope.rejected',
  'milestone.scope.cancelled',
  'dependency.crossbundle.created',
  'workitem.estimate.requested',
  'dependency.criticalpath.escalation',
  'sprint.status.changed',
  'sprint.close.blocked',
  'sprint.capacity.override',
  'workitem.stale.nudge',
  'workitem.stale.summary',
  'digest.daily'
];

const DEFAULT_SETTINGS = {
  _id: 'global',
  enabledTypes: DEFAULT_NOTIFICATION_TYPES.reduce((acc: Record<string, boolean>, type) => {
    acc[type] = true;
    return acc;
  }, {} as Record<string, boolean>),
  routing: {
    includeAdmins: true,
    includeBundleOwners: true,
    includeActorOnBlocked: true
  },
  digest: {
    enabled: false,
    cadence: 'DAILY' as const,
    hourLocal: 9
  },
  updatedAt: new Date().toISOString(),
  updatedBy: 'system'
};

type Actor = {
  userId?: string;
  displayName?: string;
  email?: string;
  role?: string;
  name?: string;
};

type Recipient = {
  userId?: string;
  name?: string;
  email?: string;
  role?: string;
};

const isAdminOrCmoRole = (role?: string) => {
  const roleName = String(role || '');
  if (!roleName) return false;
  const lower = roleName.toLowerCase();
  if (lower.includes('admin')) return true;
  if (lower.includes('cmo')) return true;
  const privilegedRoles = new Set([
    'CMO Architect',
    'CMO Member'
  ]);
  return privilegedRoles.has(roleName);
};

let cachedSettings: { value: any; ts: number } | null = null;
let cachedSettingsKey: string | null = null;
const SETTINGS_TTL_MS = 30_000;

export const getNotificationSettings = async () => {
  const now = Date.now();
  const cacheKey = process.env.MONGO_URL || 'default';
  if (cachedSettings && cachedSettingsKey === cacheKey && now - cachedSettings.ts < SETTINGS_TTL_MS) {
    return cachedSettings.value;
  }
  const existing = await getNotificationSettingsDoc();
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(existing || {}),
    enabledTypes: {
      ...DEFAULT_SETTINGS.enabledTypes,
      ...(existing?.enabledTypes || {})
    },
    routing: {
      ...DEFAULT_SETTINGS.routing,
      ...(existing?.routing || {})
    },
    digest: {
      ...DEFAULT_SETTINGS.digest,
      ...(existing?.digest || {})
    }
  };
  cachedSettings = { value: merged, ts: now };
  cachedSettingsKey = cacheKey;
  return merged;
};

export const saveNotificationSettings = async (input: any, userId: string) => {
  const next = {
    ...DEFAULT_SETTINGS,
    ...input,
    enabledTypes: { ...DEFAULT_SETTINGS.enabledTypes, ...(input?.enabledTypes || {}) },
    routing: { ...DEFAULT_SETTINGS.routing, ...(input?.routing || {}) },
    digest: { ...DEFAULT_SETTINGS.digest, ...(input?.digest || {}) },
    updatedAt: new Date().toISOString(),
    updatedBy: userId || 'system'
  };
  await saveNotificationSettingsDoc(next);
  cachedSettings = { value: next, ts: Date.now() };
  cachedSettingsKey = process.env.MONGO_URL || 'default';
  return next;
};

export const getUserNotificationPrefs = async (userId: string) => {
  const prefs = await getUserNotificationPrefsDoc(userId);
  return prefs || { userId, mutedTypes: [], digestOptIn: false };
};

export const saveUserNotificationPrefs = async (userId: string, input: any) => {
  const mutedTypes = Array.isArray(input?.mutedTypes) ? Array.from(new Set(input.mutedTypes.filter(Boolean))) : [];
  const digestOptIn = Boolean(input?.digestOptIn);
  const payload = { userId, mutedTypes, digestOptIn };
  await saveUserNotificationPrefsDoc(userId, payload);
  return payload;
};

const resolveAdminCmoRecipients = async () => {
  const adminRows = await listAdmins();
  const adminUsers = await listUsersByAnyIds(adminRows.map((row: any) => String(row.userId || '')).filter(Boolean));
  const cmoUsers = await searchUsersWithFilters({
    roleClauses: [{ role: { $regex: /cmo/i } }, { role: { $regex: /admin/i } }]
  });
  const combined = [...adminUsers, ...cmoUsers].filter((user: any) => isAdminOrCmoRole(user.role) || adminRows.some((row: any) => String(row.userId) === String(user._id || user.id || user.userId || '')));
  return combined.map((u: any) => ({
    userId: String(u._id || u.id || u.userId || ''),
    name: String(u.name || ''),
    email: String(u.email || ''),
    role: u.role
  }));
};

const resolveBundleOwners = async (bundleId?: string) => {
  if (!bundleId) return [];
  const assignments = await listBundleAssignments({
    bundleId: String(bundleId),
    assignmentType: 'bundle_owner',
    active: true
  });
  const userIds = assignments.map((a: any) => String(a.userId || '')).filter(Boolean);
  if (!userIds.length) return [];
  const users = await listUsersByAnyIds(userIds);
  return users.map((u: any) => ({
    userId: String(u._id || u.id || u.userId || ''),
    name: String(u.name || ''),
    email: String(u.email || ''),
    role: u.role
  }));
};

const uniqueRecipients = (list: Recipient[]) => {
  const map = new Map<string, Recipient>();
  list.forEach((r) => {
    const key = r.userId || r.email || r.name || '';
    if (!key) return;
    if (!map.has(key)) map.set(key, r);
  });
  return Array.from(map.values());
};

const filterRecipientsByVisibility = async (
  recipients: Recipient[],
  scope: { bundleIds?: string[]; milestoneId?: string; workItem?: any }
) => {
  if (!recipients.length) return [];
  const bundleIds = (scope.bundleIds || []).filter(Boolean);
  const milestoneId = scope.milestoneId ? String(scope.milestoneId) : '';
  const workItem = scope.workItem || null;
  if (!bundleIds.length && !milestoneId && !workItem) return recipients;
  const filtered: Recipient[] = [];
  for (const recipient of recipients) {
    if (!recipient.userId) {
      filtered.push(recipient);
      continue;
    }
    const visibility = createVisibilityContext({
      userId: recipient.userId,
      role: recipient.role,
      email: recipient.email
    });
    let allowed = true;
    if (bundleIds.length) {
      const checks = await Promise.all(bundleIds.map((id) => visibility.canViewBundle(id)));
      allowed = checks.some(Boolean);
    } else if (milestoneId) {
      allowed = await visibility.canViewMilestone(milestoneId);
    } else if (workItem) {
      allowed = await visibility.canViewWorkItem(workItem);
    }
    if (allowed) filtered.push(recipient);
  }
  return filtered;
};

const resolveRecipientNamesByIds = async (ids: string[]) => {
  const clean = ids.filter(Boolean);
  if (!clean.length) return [];
  const users = await listUsersByAnyIds(clean);
  return users.map((u: any) => String(u.name || u.email || '')).filter(Boolean);
};

const resolveWatchersByScopes = async (scopes: Array<{ scopeType: 'BUNDLE' | 'MILESTONE'; scopeId: string }>) => {
  const userIds = await listWatcherUserIdsForScopes(scopes);
  if (!userIds.length) return [] as Recipient[];
  const users = await listUsersByAnyIds(userIds);
  return users.map((u: any) => ({
    userId: String(u._id || u.id || u.userId || ''),
    name: String(u.name || ''),
    email: String(u.email || ''),
    role: u.role
  }));
};

const buildNotification = (input: {
  recipient: string;
  sender: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  severity?: 'info' | 'warn' | 'critical';
}) => ({
  recipient: input.recipient,
  sender: input.sender,
  type: input.type,
  title: input.title,
  body: input.body,
  message: `${input.title} — ${input.body}`.trim(),
  link: input.link,
  severity: input.severity || 'info',
  read: false,
  createdAt: new Date().toISOString()
});

const DIGEST_ELIGIBLE = new Set([
  'milestone.status.changed',
  'dependency.crossbundle.created',
  'workitem.stale.summary',
  'milestone.commitment.drift'
]);

const filterRecipientsByPrefs = async (recipients: Recipient[], type: string, settings: any) => {
  const withIds = recipients.filter((r) => r.userId);
  const prefsDocs = withIds.length ? await listUserNotificationPrefsDocs(withIds.map((recipient) => String(recipient.userId || ''))) : [];
  const prefMap = new Map<string, { mutedTypes?: string[]; digestOptIn?: boolean }>(prefsDocs.map((p: any) => [p.userId, p]));

  const immediates: Recipient[] = [];
  const digestQueue: Array<{ userId: string; type: string; title: string; body: string; link?: string }> = [];

  for (const recipient of recipients) {
    const userId = recipient.userId;
    const prefs = userId ? prefMap.get(userId) : null;
    const muted = prefs?.mutedTypes || [];
    if (muted.includes(type)) continue;

    const digestEligible = settings.digest?.enabled && prefs?.digestOptIn && DIGEST_ELIGIBLE.has(type) && userId;
    if (digestEligible) {
      digestQueue.push({ userId, type, title: '', body: '', link: undefined });
    } else {
      immediates.push(recipient);
    }
  }

  return { immediates, digestQueue };
};

export const createNotificationsForEvent = async (input: {
  type: string;
  actor?: Actor;
  payload: any;
}) => {
  const settings = await getNotificationSettings();
  if (settings.enabledTypes && settings.enabledTypes[input.type] === false) return;

  const now = new Date().toISOString();
  const sender = String(input.actor?.displayName || input.actor?.name || input.actor?.email || 'System');

  const buildForRecipients = async (recipients: Recipient[], title: string, body: string, link?: string, severity: 'info' | 'warn' | 'critical' = 'info') => {
    const { immediates } = await filterRecipientsByPrefs(recipients, input.type, settings);
    const notifications = immediates.map((r) => buildNotification({
      recipient: r.name || r.email || r.userId || 'Unknown',
      sender,
      type: input.type,
      title,
      body,
      link,
      severity
    }));
    await insertClassicNotifications(notifications);
  };

  const queueDigestForRecipients = async (recipients: Recipient[], title: string, body: string, link?: string) => {
    const { digestQueue } = await filterRecipientsByPrefs(recipients, input.type, settings);
    const items = digestQueue.map((entry) => ({
      userId: entry.userId,
      type: input.type,
      title,
      body,
      link,
      createdAt: now
    }));
    await enqueueNotificationDigestItems(items);
  };

  const routeRecipients = async (list: Recipient[], title: string, body: string, link?: string, severity: 'info' | 'warn' | 'critical' = 'info') => {
    await queueDigestForRecipients(list, title, body, link);
    await buildForRecipients(list, title, body, link, severity);
  };

  if (input.type === 'milestone.status.changed') {
    const milestone = input.payload?.milestone || {};
    const watcherRecipients = await resolveWatchersByScopes([{ scopeType: 'MILESTONE', scopeId: String(milestone._id || milestone.id || milestone.name || '') }]);
    let recipients = uniqueRecipients([
      ...(settings.routing.includeAdmins ? await resolveAdminCmoRecipients() : []),
      ...(settings.routing.includeBundleOwners ? await resolveBundleOwners(milestone.bundleId) : []),
      ...watcherRecipients
    ]);
    recipients = await filterRecipientsByVisibility(recipients, { bundleIds: [String(milestone.bundleId || '')], milestoneId: String(milestone._id || milestone.id || milestone.name || '') });
    const title = `Milestone ${milestone.name || milestone.id || milestone._id} status changed`;
    const body = `${input.payload?.from || '—'} → ${input.payload?.to || '—'}`;
    const link = `/work-items?view=milestone-plan`;
    await routeRecipients(recipients, title, body, link, 'info');
  }

  if (input.type === 'milestone.status.override') {
    const milestone = input.payload?.milestone || {};
    const watcherRecipients = await resolveWatchersByScopes([{ scopeType: 'MILESTONE', scopeId: String(milestone._id || milestone.id || milestone.name || '') }]);
    let recipients = uniqueRecipients([
      ...(settings.routing.includeAdmins ? await resolveAdminCmoRecipients() : []),
      ...(settings.routing.includeBundleOwners ? await resolveBundleOwners(milestone.bundleId) : []),
      ...watcherRecipients
    ]);
    recipients = await filterRecipientsByVisibility(recipients, { bundleIds: [String(milestone.bundleId || '')], milestoneId: String(milestone._id || milestone.id || milestone.name || '') });
    const title = `Milestone override used`;
    const reason = input.payload?.overrideReason ? `Reason: ${input.payload.overrideReason}` : 'No reason provided';
    const band = input.payload?.readiness?.band || 'unknown';
    const score = input.payload?.readiness?.score ?? '—';
    const body = `${milestone.name || milestone.id || milestone._id} • Readiness ${band} (${score}). ${reason}`;
    const link = `/work-items?view=milestone-plan`;
    await routeRecipients(recipients, title, body, link, 'warn');
  }

  if (input.type === 'milestone.readiness.blocked') {
    const milestone = input.payload?.milestone || {};
    const blockers = (input.payload?.readiness?.blockers || []).slice(0, 3).map((b: any) => b.detail).join('; ');
    const watcherRecipients = await resolveWatchersByScopes([{ scopeType: 'MILESTONE', scopeId: String(milestone._id || milestone.id || milestone.name || '') }]);
    const actorRecipient: Recipient | null = input.actor?.userId ? {
      userId: String(input.actor.userId),
      name: input.actor.displayName || input.actor.name || input.actor.email,
      email: input.actor.email
    } : null;
    let recipients = uniqueRecipients([
      ...(settings.routing.includeAdmins ? await resolveAdminCmoRecipients() : []),
      ...(settings.routing.includeActorOnBlocked && actorRecipient ? [actorRecipient] : []),
      ...watcherRecipients
    ]);
    recipients = await filterRecipientsByVisibility(recipients, { bundleIds: [String(milestone.bundleId || '')], milestoneId: String(milestone._id || milestone.id || milestone.name || '') });
    const title = `Milestone readiness blocked`;
    const body = `${milestone.name || milestone.id || milestone._id} • ${blockers || 'Readiness gates not satisfied'}`;
    const link = `/work-items?view=milestone-plan`;
    await routeRecipients(recipients, title, body, link, 'warn');
  }

  if (input.type === 'milestone.owner.changed') {
    const milestone = input.payload?.milestone || {};
    const watcherRecipients = await resolveWatchersByScopes([{ scopeType: 'MILESTONE', scopeId: String(milestone._id || milestone.id || milestone.name || '') }]);
    const ownerRecipient: Recipient | null = milestone.ownerUserId ? {
      userId: String(milestone.ownerUserId),
      email: milestone.ownerEmail ? String(milestone.ownerEmail) : undefined,
      name: milestone.ownerEmail || milestone.ownerUserId
    } : (milestone.ownerEmail ? { email: String(milestone.ownerEmail), name: String(milestone.ownerEmail) } : null);
    let recipients = uniqueRecipients([
      ...(ownerRecipient ? [ownerRecipient] : []),
      ...watcherRecipients
    ]);
    recipients = await filterRecipientsByVisibility(recipients, { bundleIds: [String(milestone.bundleId || '')], milestoneId: String(milestone._id || milestone.id || milestone.name || '') });
    const title = `Milestone owner updated`;
    const body = `${milestone.name || milestone.id || milestone._id} owner set`;
    const link = `/work-items?view=milestone-plan`;
    await routeRecipients(recipients, title, body, link, 'info');
  }

  if (input.type === 'milestone.capacity.override') {
    const milestone = input.payload?.milestone || {};
    const item = input.payload?.item || {};
    const details = input.payload?.details || {};
    const watcherRecipients = await resolveWatchersByScopes([
      { scopeType: 'MILESTONE', scopeId: String(milestone._id || milestone.id || milestone.name || '') },
      { scopeType: 'BUNDLE', scopeId: String(item.bundleId || milestone.bundleId || '') }
    ]);
    let recipients = uniqueRecipients([
      ...(settings.routing.includeAdmins ? await resolveAdminCmoRecipients() : []),
      ...(settings.routing.includeBundleOwners ? await resolveBundleOwners(item.bundleId) : []),
      ...watcherRecipients
    ]);
    recipients = await filterRecipientsByVisibility(recipients, { bundleIds: [String(item.bundleId || milestone.bundleId || '')], milestoneId: String(milestone._id || milestone.id || milestone.name || '') });
    const title = `Capacity override used`;
    const body = `${item.key || item.title || 'Work item'} in ${milestone.name || milestone.id || milestone._id} • ${details.currentCommittedPoints || 0}/${details.targetCapacity || '—'} +${details.incomingItemPoints || 0}`;
    const link = `/work-items?view=milestone-plan`;
    await routeRecipients(recipients, title, body, link, 'warn');
  }

  if (input.type === 'milestone.commitment.drift') {
    const milestone = input.payload?.milestone || {};
    const drift = input.payload?.drift || {};
    const watcherRecipients = await resolveWatchersByScopes([{ scopeType: 'MILESTONE', scopeId: String(milestone._id || milestone.id || milestone.name || '') }]);
    const ownerRecipient: Recipient | null = milestone.ownerUserId ? {
      userId: String(milestone.ownerUserId),
      email: milestone.ownerEmail ? String(milestone.ownerEmail) : undefined,
      name: milestone.ownerEmail || milestone.ownerUserId
    } : (milestone.ownerEmail ? { email: String(milestone.ownerEmail), name: String(milestone.ownerEmail) } : null);
    let recipients = uniqueRecipients([
      ...(settings.routing.includeAdmins ? await resolveAdminCmoRecipients() : []),
      ...(settings.routing.includeBundleOwners ? await resolveBundleOwners(milestone.bundleId) : []),
      ...(ownerRecipient ? [ownerRecipient] : []),
      ...watcherRecipients
    ]);
    recipients = await filterRecipientsByVisibility(recipients, { bundleIds: [String(milestone.bundleId || '')], milestoneId: String(milestone._id || milestone.id || milestone.name || '') });
    const title = `Commitment drift detected`;
    const body = `${milestone.name || milestone.id || milestone._id} • ${drift.driftBand || 'MAJOR'} drift`;
    const link = `/work-items?view=roadmap`;
    await routeRecipients(recipients, title, body, link, 'warn');
  }

  if (input.type === 'milestone.scope.requested') {
    const milestone = input.payload?.milestone || {};
    const requester = input.payload?.requester || {};
    const watcherRecipients = await resolveWatchersByScopes([
      { scopeType: 'MILESTONE', scopeId: String(milestone._id || milestone.id || milestone.name || '') },
      { scopeType: 'BUNDLE', scopeId: String(milestone.bundleId || '') }
    ]);
    let recipients = uniqueRecipients([
      ...(settings.routing.includeAdmins ? await resolveAdminCmoRecipients() : []),
      ...(settings.routing.includeBundleOwners ? await resolveBundleOwners(milestone.bundleId) : []),
      ...watcherRecipients
    ]);
    recipients = await filterRecipientsByVisibility(recipients, { bundleIds: [String(milestone.bundleId || '')], milestoneId: String(milestone._id || milestone.id || milestone.name || '') });
    const title = `Scope change request submitted`;
    const body = `${milestone.name || milestone.id || milestone._id} • ${requester.name || requester.email || requester.userId || 'Requester'}`;
    const link = `/work-items?view=milestone-plan`;
    await routeRecipients(recipients, title, body, link, 'info');
  }

  if (input.type === 'milestone.scope.approved' || input.type === 'milestone.scope.rejected' || input.type === 'milestone.scope.cancelled') {
    const milestone = input.payload?.milestone || {};
    const requester = input.payload?.requester || {};
    const decision = input.type.split('.').pop();
    const watcherRecipients = await resolveWatchersByScopes([
      { scopeType: 'MILESTONE', scopeId: String(milestone._id || milestone.id || milestone.name || '') },
      { scopeType: 'BUNDLE', scopeId: String(milestone.bundleId || '') }
    ]);
    const requesterRecipient: Recipient | null = requester?.userId ? {
      userId: String(requester.userId),
      name: requester.name || requester.displayName || requester.email,
      email: requester.email
    } : null;
    let recipients = uniqueRecipients([
      ...(requesterRecipient ? [requesterRecipient] : []),
      ...watcherRecipients
    ]);
    recipients = await filterRecipientsByVisibility(recipients, { bundleIds: [String(milestone.bundleId || '')], milestoneId: String(milestone._id || milestone.id || milestone.name || '') });
    const title = `Scope request ${decision}`;
    const body = `${milestone.name || milestone.id || milestone._id}`;
    const link = `/work-items?view=milestone-plan`;
    await routeRecipients(recipients, title, body, link, decision === 'approved' ? 'info' : decision === 'rejected' ? 'warn' : 'info');
  }

  if (input.type === 'dependency.crossbundle.created') {
    const blocker = input.payload?.blocker || {};
    const blocked = input.payload?.blocked || {};
    const watcherRecipients = await resolveWatchersByScopes([
      { scopeType: 'BUNDLE', scopeId: String(blocker.bundleId || '') },
      { scopeType: 'BUNDLE', scopeId: String(blocked.bundleId || '') }
    ]);
    let recipients = uniqueRecipients([
      ...(settings.routing.includeAdmins ? await resolveAdminCmoRecipients() : []),
      ...(settings.routing.includeBundleOwners ? await resolveBundleOwners(blocker.bundleId) : []),
      ...(settings.routing.includeBundleOwners ? await resolveBundleOwners(blocked.bundleId) : []),
      ...watcherRecipients
    ]);
    recipients = await filterRecipientsByVisibility(recipients, { bundleIds: [String(blocker.bundleId || ''), String(blocked.bundleId || '')] });
    const title = `Cross-bundle blocker created`;
    const body = `${blocker.key || blocker.title || blocker._id} → ${blocked.key || blocked.title || blocked._id}`;
    const link = `/program${blocked.bundleId ? `?bundleIds=${encodeURIComponent(String(blocked.bundleId))}` : ''}`;
    await routeRecipients(recipients, title, body, link, 'critical');
  }

  if (input.type === 'workitem.estimate.requested') {
    const item = input.payload?.item || {};
    const milestoneId = input.payload?.milestoneId;
    const reason = input.payload?.reason || 'Estimate requested for critical path.';
    const assigneeToken = item.assignedTo ? [String(item.assignedTo)] : [];
    const assigneeRecipients = assigneeToken.length ? await resolveUsersForMentions(assigneeToken) : [];
    const scopes: Array<{ scopeType: 'BUNDLE' | 'MILESTONE'; scopeId: string }> = [
      { scopeType: 'BUNDLE', scopeId: String(item.bundleId || '') }
    ];
    if (milestoneId) {
      scopes.push({ scopeType: 'MILESTONE', scopeId: String(milestoneId) });
    }
    const watcherRecipients = await resolveWatchersByScopes(scopes);
    let recipients = uniqueRecipients([
      ...assigneeRecipients.map((u: any) => ({ userId: u.userId, name: u.displayName, email: u.email })),
      ...(settings.routing.includeBundleOwners ? await resolveBundleOwners(item.bundleId) : []),
      ...watcherRecipients
    ]);
    recipients = await filterRecipientsByVisibility(recipients, { bundleIds: [String(item.bundleId || '')], milestoneId: milestoneId ? String(milestoneId) : undefined, workItem: item });
    const title = `Estimate requested: ${item.key || item.title || item._id}`;
    const body = reason;
    const link = `/work-items?view=milestone-plan`;
    await routeRecipients(recipients, title, body, link, 'info');
  }

  if (input.type === 'dependency.criticalpath.escalation') {
    const item = input.payload?.item || {};
    const milestoneId = input.payload?.milestoneId;
    const reason = input.payload?.reason || 'External blocker on critical path.';
    const scopes: Array<{ scopeType: 'BUNDLE' | 'MILESTONE'; scopeId: string }> = [
      { scopeType: 'BUNDLE', scopeId: String(item.bundleId || '') }
    ];
    if (milestoneId) {
      scopes.push({ scopeType: 'MILESTONE', scopeId: String(milestoneId) });
    }
    const watcherRecipients = await resolveWatchersByScopes(scopes);
    let recipients = uniqueRecipients([
      ...(settings.routing.includeAdmins ? await resolveAdminCmoRecipients() : []),
      ...(settings.routing.includeBundleOwners ? await resolveBundleOwners(item.bundleId) : []),
      ...watcherRecipients
    ]);
    recipients = await filterRecipientsByVisibility(recipients, { bundleIds: [String(item.bundleId || '')], milestoneId: milestoneId ? String(milestoneId) : undefined, workItem: item });
    const title = `Critical path escalation: ${item.key || item.title || item._id}`;
    const body = reason;
    const link = item.bundleId ? `/program?bundleId=${encodeURIComponent(String(item.bundleId))}` : `/program`;
    await routeRecipients(recipients, title, body, link, 'critical');
  }

  if (input.type === 'workitem.stale.nudge') {
    const item = input.payload?.item || {};
    const milestone = input.payload?.milestone || {};
    const reason = input.payload?.reason || 'Stale work item';
    const assigneeTokens = item.assignedTo ? [String(item.assignedTo)] : [];
    const assigneeRecipients = assigneeTokens.length ? await resolveUsersForMentions(assigneeTokens) : [];
    const assigneeUsers = Array.isArray(item.assigneeUserIds) && item.assigneeUserIds.length
      ? await listUsersByAnyIds(item.assigneeUserIds.map(String))
      : [];
    const milestoneOwnerRecipient: Recipient | null = milestone?.ownerUserId
      ? {
        userId: String(milestone.ownerUserId),
        name: milestone.ownerEmail || milestone.ownerUserId,
        email: milestone.ownerEmail ? String(milestone.ownerEmail) : undefined
      }
      : null;
    const scopes: Array<{ scopeType: 'BUNDLE' | 'MILESTONE'; scopeId: string }> = [
      { scopeType: 'BUNDLE', scopeId: String(item.bundleId || '') }
    ];
    const milestoneId = milestone?._id || milestone?.id || milestone?.name;
    if (milestoneId) scopes.push({ scopeType: 'MILESTONE', scopeId: String(milestoneId) });
    const watcherRecipients = await resolveWatchersByScopes(scopes);
    let recipients = uniqueRecipients([
      ...assigneeRecipients.map((u: any) => ({ userId: u.userId, name: u.displayName, email: u.email })),
      ...assigneeUsers.map((u: any) => ({ userId: String(u._id || u.id || ''), name: String(u.name || ''), email: u.email ? String(u.email) : undefined, role: u.role })),
      ...(milestoneOwnerRecipient ? [milestoneOwnerRecipient] : []),
      ...(settings.routing.includeBundleOwners ? await resolveBundleOwners(item.bundleId) : []),
      ...watcherRecipients
    ]);
    recipients = await filterRecipientsByVisibility(recipients, {
      bundleIds: [String(item.bundleId || '')],
      milestoneId: milestoneId ? String(milestoneId) : undefined,
      workItem: item
    });
    const title = `Stale work item nudged: ${item.key || item.title || item._id}`;
    const body = reason;
    const link = item?._id || item?.id ? `/work-items/${encodeURIComponent(String(item._id || item.id))}` : `/work-items?view=tree`;
    await routeRecipients(recipients, title, body, link, 'warn');
  }

  if (input.type === 'workitem.stale.summary') {
    const summary = input.payload?.summary || 'Stale work items summary';
    const userId = input.payload?.userId;
    if (!userId) return;
    const recipients: Recipient[] = [{
      userId: String(userId),
      name: input.payload?.userName || String(userId),
      email: input.payload?.userEmail
    }];
    const title = 'Stale work items summary';
    const body = summary;
    const link = input.payload?.link || '/work-items?view=milestone-plan';
    await routeRecipients(recipients, title, body, link, 'info');
  }

  if (input.type === 'sprint.status.changed') {
    const sprint = input.payload?.sprint || {};
    const watcherRecipients = await resolveWatchersByScopes([
      { scopeType: 'BUNDLE', scopeId: String(sprint.bundleId || '') }
    ]);
    let recipients = uniqueRecipients([
      ...(settings.routing.includeAdmins ? await resolveAdminCmoRecipients() : []),
      ...(settings.routing.includeBundleOwners ? await resolveBundleOwners(sprint.bundleId) : []),
      ...watcherRecipients
    ]);
    recipients = await filterRecipientsByVisibility(recipients, { bundleIds: [String(sprint.bundleId || '')] });
    const title = `Sprint ${sprint.name || sprint.id || sprint._id} status changed`;
    const body = `${input.payload?.from || '—'} → ${input.payload?.to || '—'}`;
    const link = `/work-items?view=sprints`;
    await routeRecipients(recipients, title, body, link, 'info');
  }

  if (input.type === 'sprint.close.blocked') {
    const sprint = input.payload?.sprint || {};
    const blockers = (input.payload?.readiness?.blockers || []).slice(0, 3).map((b: any) => b.detail).join('; ');
    const watcherRecipients = await resolveWatchersByScopes([
      { scopeType: 'BUNDLE', scopeId: String(sprint.bundleId || '') }
    ]);
    const actorRecipient: Recipient | null = input.actor?.userId ? {
      userId: String(input.actor.userId),
      name: input.actor.displayName || input.actor.name || input.actor.email,
      email: input.actor.email
    } : null;
    let recipients = uniqueRecipients([
      ...(settings.routing.includeAdmins ? await resolveAdminCmoRecipients() : []),
      ...(settings.routing.includeBundleOwners ? await resolveBundleOwners(sprint.bundleId) : []),
      ...(settings.routing.includeActorOnBlocked && actorRecipient ? [actorRecipient] : []),
      ...watcherRecipients
    ]);
    recipients = await filterRecipientsByVisibility(recipients, { bundleIds: [String(sprint.bundleId || '')] });
    const title = `Sprint close blocked`;
    const body = `${sprint.name || sprint.id || sprint._id} • ${blockers || 'Readiness gates not satisfied'}`;
    const link = `/work-items?view=sprints`;
    await routeRecipients(recipients, title, body, link, 'warn');
  }

  if (input.type === 'sprint.capacity.override') {
    const sprint = input.payload?.sprint || {};
    const item = input.payload?.item || {};
    const details = input.payload?.details || {};
    const watcherRecipients = await resolveWatchersByScopes([
      { scopeType: 'BUNDLE', scopeId: String(sprint.bundleId || item.bundleId || '') }
    ]);
    let recipients = uniqueRecipients([
      ...(settings.routing.includeAdmins ? await resolveAdminCmoRecipients() : []),
      ...(settings.routing.includeBundleOwners ? await resolveBundleOwners(sprint.bundleId || item.bundleId) : []),
      ...watcherRecipients
    ]);
    recipients = await filterRecipientsByVisibility(recipients, { bundleIds: [String(sprint.bundleId || item.bundleId || '')] });
    const title = `Sprint capacity override used`;
    const body = `${item.key || item.title || 'Work item'} in ${sprint.name || sprint.id || sprint._id} • ${details.currentCommittedPoints || 0}/${details.targetCapacity || '—'} +${details.incomingItemPoints || 0}`;
    const link = `/work-items?view=sprints`;
    await routeRecipients(recipients, title, body, link, 'warn');
  }
};

export { resolveRecipientNamesByIds };
