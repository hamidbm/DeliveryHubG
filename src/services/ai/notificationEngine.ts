import { ObjectId } from 'mongodb';
import {
  HealthScore,
  Notification,
  PortfolioAlert,
  PortfolioTrendSignal,
  StructuredPortfolioReport,
  Watcher,
  WatcherType
} from '../../types/ai';
import { dispatchNotification } from './notificationDispatcher';
import { enforceWatcherQuota, getWatcherUsageForUser } from './notificationPolicy';
import {
  createAiWatcherRecord,
  deleteAiWatcherForUserRecord,
  insertAiNotificationRecord,
  listAiNotificationsForUserRecords,
  listAiWatchersForUserRecords,
  listEnabledAiWatchersForUserRecords,
  updateAiNotificationReadStateRecord,
  updateAiWatcherForUserRecord,
  updateAiWatcherLastTriggeredRecord
} from '../../server/db/repositories/aiNotificationsRepo';

const TRIGGER_COOLDOWN_MS = 30 * 60 * 1000;

type EvaluateContext = {
  report: StructuredPortfolioReport;
  trendSignals?: PortfolioTrendSignal[];
  healthScore?: HealthScore;
  alerts?: PortfolioAlert[];
  investigationSnapshots?: Array<{ id: string; answer?: string; explanation?: string }>;
};

const nowIso = () => new Date().toISOString();

const toObjectId = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : id);

const toWatcher = (row: any): Watcher => ({
  id: String(row._id || row.id || ''),
  userId: String(row.userId || ''),
  type: String(row.type || 'trend') as WatcherType,
  targetId: String(row.targetId || ''),
  condition: row.condition || {},
  deliveryPreferences: row.deliveryPreferences || {
    in_app: { enabled: true },
    email: { enabled: false },
    slack: { enabled: false },
    teams: { enabled: false },
    digest: { enabled: false, frequency: 'daily' }
  },
  enabled: row.enabled !== false,
  createdAt: String(row.createdAt || nowIso()),
  lastTriggeredAt: row.lastTriggeredAt ? String(row.lastTriggeredAt) : undefined
});

const toNotification = (row: any): Notification => ({
  id: String(row._id || row.id || ''),
  watcherId: String(row.watcherId || ''),
  userId: String(row.userId || ''),
  title: String(row.title || ''),
  message: String(row.message || ''),
  severity: row.severity,
  relatedEntities: Array.isArray(row.relatedEntities) ? row.relatedEntities : [],
  relatedInvestigationId: row.relatedInvestigationId ? String(row.relatedInvestigationId) : undefined,
  createdAt: String(row.createdAt || nowIso()),
  read: Boolean(row.read),
  deliveryMode: row.deliveryMode || 'immediate',
  delivery: row.delivery || undefined
});

export const listWatchersForUser = async (userId: string): Promise<Watcher[]> => {
  const rows = await listAiWatchersForUserRecords(String(userId));
  return rows.map(toWatcher);
};

export const createWatcherForUser = async (
  userId: string,
  payload: {
    type: WatcherType;
    targetId: string;
    condition?: Record<string, any>;
    enabled?: boolean;
    deliveryPreferences?: Watcher['deliveryPreferences'];
  }
): Promise<string> => {
  await enforceWatcherQuota(String(userId));
  const now = nowIso();
  const doc = {
    userId: String(userId),
    type: payload.type,
    targetId: String(payload.targetId || '').trim(),
    condition: payload.condition || {},
    deliveryPreferences: payload.deliveryPreferences || {
      in_app: { enabled: true },
      email: { enabled: false },
      slack: { enabled: false },
      teams: { enabled: false },
      digest: { enabled: false, frequency: 'daily' }
    },
    enabled: payload.enabled !== false,
    createdAt: now,
    lastTriggeredAt: undefined
  };
  const res = await createAiWatcherRecord(doc);
  console.info('notification_metric', JSON.stringify({
    name: 'watchers.created',
    userId: String(userId),
    watcherId: String(res.insertedId),
    timestamp: nowIso()
  }));
  return String(res.insertedId);
};

export const updateWatcherForUser = async (
  userId: string,
  watcherId: string,
  patch: Partial<Pick<Watcher, 'enabled' | 'condition' | 'targetId' | 'deliveryPreferences'>>
): Promise<boolean> => {
  const setData: any = {};
  if (typeof patch.enabled === 'boolean') setData.enabled = patch.enabled;
  if (typeof patch.targetId === 'string') setData.targetId = patch.targetId.trim();
  if (patch.condition && typeof patch.condition === 'object') setData.condition = patch.condition;
  if (patch.deliveryPreferences && typeof patch.deliveryPreferences === 'object') {
    setData.deliveryPreferences = patch.deliveryPreferences;
  }
  if (!Object.keys(setData).length) return false;

  const res = await updateAiWatcherForUserRecord(String(userId), watcherId, setData);
  return res.modifiedCount > 0;
};

export const deleteWatcherForUser = async (userId: string, watcherId: string): Promise<boolean> => {
  const res = await deleteAiWatcherForUserRecord(String(userId), watcherId);
  if (res.deletedCount > 0) {
    console.info('notification_metric', JSON.stringify({
      name: 'watchers.deleted',
      userId: String(userId),
      watcherId: String(watcherId),
      timestamp: nowIso()
    }));
  }
  return res.deletedCount > 0;
};

export const getWatcherUsage = async (userId: string): Promise<{ used: number; max: number }> => {
  return getWatcherUsageForUser(String(userId));
};

export const listNotificationsForUser = async (userId: string): Promise<Notification[]> => {
  const rows = await listAiNotificationsForUserRecords(String(userId), 200);
  return rows.map(toNotification);
};

export const updateNotificationReadState = async (userId: string, notificationId: string, read: boolean): Promise<boolean> => {
  const res = await updateAiNotificationReadStateRecord(String(userId), notificationId, Boolean(read));
  return res.modifiedCount > 0;
};

const meetsHealthCondition = (score: number, condition: Record<string, any>) => {
  const operator = String(condition?.operator || '<=').trim();
  const threshold = Number(condition?.threshold ?? 60);
  if (!Number.isFinite(threshold)) return false;
  if (operator === '<=') return score <= threshold;
  if (operator === '<') return score < threshold;
  if (operator === '>=') return score >= threshold;
  if (operator === '>') return score > threshold;
  if (operator === '=') return score === threshold;
  return false;
};

const parseLastTriggered = (watcher: Watcher) => {
  if (!watcher.lastTriggeredAt) return 0;
  const ts = new Date(watcher.lastTriggeredAt).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

const canTrigger = (watcher: Watcher) => Date.now() - parseLastTriggered(watcher) > TRIGGER_COOLDOWN_MS;

const normalizeSeverityWeight = (severity: string) => {
  if (severity === 'critical') return 4;
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
};

const evaluateWatcher = (
  watcher: Watcher,
  context: EvaluateContext
): null | {
  title: string;
  message: string;
  severity?: Notification['severity'];
  relatedEntities?: Notification['relatedEntities'];
  relatedInvestigationId?: string;
} => {
  const alerts = context.alerts || context.report.alerts || [];
  const trendSignals = context.trendSignals || context.report.trendSignals || [];
  const healthScore = context.healthScore || context.report.healthScore;

  if (watcher.type === 'alert') {
    const target = watcher.targetId.toLowerCase();
    const matched = alerts.filter((alert) => {
      const byId = alert.id.toLowerCase() === target;
      const byResultOf = alert.resultOf.toLowerCase() === target;
      const byTitle = alert.title.toLowerCase().includes(target);
      return byId || byResultOf || byTitle;
    });
    if (!matched.length) return null;

    const minSeverity = String(watcher.condition?.minSeverity || '').toLowerCase();
    const filtered = minSeverity
      ? matched.filter((alert) => normalizeSeverityWeight(alert.severity) >= normalizeSeverityWeight(minSeverity))
      : matched;
    if (!filtered.length) return null;

    const top = filtered.sort((a, b) => normalizeSeverityWeight(b.severity) - normalizeSeverityWeight(a.severity))[0];
    return {
      title: `Alert watcher triggered: ${top.title}`,
      message: `${top.summary} (severity: ${top.severity})`,
      severity: top.severity,
      relatedEntities: top.entities || []
    };
  }

  if (watcher.type === 'trend') {
    const trend = trendSignals.find((item) => item.metric === watcher.targetId);
    if (!trend) return null;
    const desiredDirection = String(watcher.condition?.direction || 'rising').toLowerCase();
    if (trend.direction !== desiredDirection) return null;
    return {
      title: `Trend watcher triggered: ${trend.metric}`,
      message: trend.summary || `${trend.metric} is ${trend.direction} (${trend.delta >= 0 ? '+' : ''}${trend.delta}) over ${trend.timeframeDays} days.`,
      severity: Math.abs(trend.delta) >= 12 ? 'critical' : Math.abs(trend.delta) >= 6 ? 'high' : Math.abs(trend.delta) >= 2 ? 'medium' : 'low'
    };
  }

  if (watcher.type === 'health') {
    if (!healthScore) return null;
    if (!meetsHealthCondition(healthScore.overall, watcher.condition || {})) return null;
    return {
      title: 'Health watcher triggered',
      message: `Portfolio health score is ${healthScore.overall}/100 and met condition ${JSON.stringify(watcher.condition || {})}.`,
      severity: healthScore.overall <= 40 ? 'critical' : healthScore.overall <= 60 ? 'high' : 'medium'
    };
  }

  if (watcher.type === 'investigation') {
    const snapshots = context.investigationSnapshots || [];
    const target = snapshots.find((entry) => String(entry.id) === watcher.targetId);
    if (!target) return null;

    const metric = String(watcher.condition?.metric || '').trim();
    const change = String(watcher.condition?.change || '').toLowerCase();
    if (!metric) {
      return {
        title: 'Investigation watcher triggered',
        message: `Investigation ${watcher.targetId} was refreshed and produced an updated answer.`,
        severity: 'medium',
        relatedInvestigationId: watcher.targetId
      };
    }

    const trend = trendSignals.find((item) => item.metric === metric);
    if (!trend) return null;
    if (change === 'increase' && trend.direction !== 'rising') return null;
    if (change === 'decrease' && trend.direction !== 'falling') return null;

    return {
      title: 'Investigation watcher triggered',
      message: `Tracked metric ${metric} is ${trend.direction} (${trend.delta >= 0 ? '+' : ''}${trend.delta}) after investigation refresh.`,
      severity: trend.direction === 'rising' ? 'high' : trend.direction === 'falling' ? 'low' : 'medium',
      relatedInvestigationId: watcher.targetId
    };
  }

  return null;
};

export const evaluateWatchersForUser = async (userId: string, context: EvaluateContext) => {
  const rows = await listEnabledAiWatchersForUserRecords(String(userId));

  const watchers = rows.map(toWatcher);
  const created: Notification[] = [];

  for (const watcher of watchers) {
    const inAppEnabled = watcher.deliveryPreferences?.in_app?.enabled !== false;
    const emailEnabled = watcher.deliveryPreferences?.email?.enabled === true;
    const slackEnabled = watcher.deliveryPreferences?.slack?.enabled === true;
    const teamsEnabled = watcher.deliveryPreferences?.teams?.enabled === true;
    if (!inAppEnabled && !emailEnabled && !slackEnabled && !teamsEnabled) continue;

    if (!canTrigger(watcher)) continue;
    const result = evaluateWatcher(watcher, context);
    if (!result) continue;

    const createdAt = nowIso();
    const notificationDoc = {
      watcherId: watcher.id,
      userId: String(userId),
      title: result.title,
      message: result.message,
      severity: result.severity || 'medium',
      relatedEntities: result.relatedEntities || [],
      relatedInvestigationId: result.relatedInvestigationId,
      createdAt,
      read: inAppEnabled ? false : true,
      delivery: {
        in_app: {
          status: 'sent',
          deliveredAt: createdAt
        },
        email: {
          status: emailEnabled ? 'pending' : 'suppressed',
          attempts: 0
        },
        slack: {
          status: slackEnabled ? 'pending' : 'suppressed',
          attempts: 0
        },
        teams: {
          status: teamsEnabled ? 'pending' : 'suppressed',
          attempts: 0
        }
      }
    };

    const insertRes = await insertAiNotificationRecord(notificationDoc);
    await updateAiWatcherLastTriggeredRecord(String(userId), watcher.id, createdAt);

    const notification = toNotification({ ...notificationDoc, _id: insertRes.insertedId });
    created.push(notification);
    void dispatchNotification(notification.id);
  }

  return created;
};
