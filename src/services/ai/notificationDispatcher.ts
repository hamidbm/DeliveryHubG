import { ObjectId } from 'mongodb';
import { Notification, NotificationDeliveryStatus, PortfolioRiskSeverity, Watcher, WatcherDeliveryPreferences } from '../../types/ai';
import { getDb } from '../db';
import { sendNotificationEmail } from './emailChannel';
import { sendSlackNotification } from './slackChannel';
import { sendTeamsNotification } from './teamsChannel';
import { enqueueNotificationForDigest, startDigestScheduler } from './digestService';
import { getNotificationPolicy, isRateLimitedForUser, isWithinQuietHours } from './notificationPolicy';
import { processNotificationRetries, startNotificationRetryScheduler } from './notificationRetryScheduler';

const WATCHERS_COLLECTION = 'ai_watchers';
const NOTIFICATIONS_COLLECTION = 'ai_notifications';
const USERS_COLLECTION = 'users';
const COOLDOWN_MS = 30 * 60 * 1000;

const CHANNELS = ['email', 'slack', 'teams'] as const;
type ExternalChannel = (typeof CHANNELS)[number];

type DispatchOptions = {
  retryFailedOnly?: boolean;
  forceDeliver?: boolean;
};

const toObjectId = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : id);

const severityRank: Record<PortfolioRiskSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const nowIso = () => new Date().toISOString();

const logDispatchEvent = (
  event: string,
  payload: {
    userId: string;
    watcherId: string;
    notificationId: string;
    channel?: ExternalChannel;
    status: string;
    errorMessage?: string;
  }
) => {
  console.info(
    event,
    JSON.stringify({
      ...payload,
      timestamp: nowIso()
    })
  );
};

const emitMetric = (name: string, payload: Record<string, string | number | boolean | undefined>) => {
  console.info('notification_metric', JSON.stringify({ name, timestamp: nowIso(), ...payload }));
};

const normalizeWatcher = (row: any): Watcher => ({
  id: String(row._id || row.id || ''),
  userId: String(row.userId || ''),
  type: row.type,
  targetId: String(row.targetId || ''),
  condition: row.condition || {},
  deliveryPreferences: row.deliveryPreferences || undefined,
  enabled: row.enabled !== false,
  createdAt: String(row.createdAt || nowIso()),
  lastTriggeredAt: row.lastTriggeredAt ? String(row.lastTriggeredAt) : undefined
});

const normalizeNotification = (row: any): Notification => ({
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

const channelSeverityMin = (preferences: WatcherDeliveryPreferences | undefined, channel: ExternalChannel) => {
  if (channel === 'email') return preferences?.email?.severityMin;
  if (channel === 'slack') return preferences?.slack?.severityMin;
  return preferences?.teams?.severityMin;
};

const channelEnabled = (preferences: WatcherDeliveryPreferences | undefined, channel: ExternalChannel) => {
  if (channel === 'email') return preferences?.email?.enabled === true;
  if (channel === 'slack') return preferences?.slack?.enabled === true;
  return preferences?.teams?.enabled === true;
};

const severityAllowed = (notification: Notification, watcher: Watcher, channel: ExternalChannel) => {
  const min = channelSeverityMin(watcher.deliveryPreferences, channel);
  if (!min) return true;
  const sev = notification.severity || 'low';
  return severityRank[sev] >= severityRank[min as PortfolioRiskSeverity];
};

const shouldSuppressByCooldown = async (db: any, notification: Notification, channel: ExternalChannel) => {
  const recentSent = await db.collection(NOTIFICATIONS_COLLECTION)
    .find({
      userId: notification.userId,
      watcherId: notification.watcherId,
      _id: { $ne: toObjectId(notification.id) },
      [`delivery.${channel}.status`]: 'sent'
    })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();

  if (!recentSent.length) return false;
  const lastAttemptedAt = recentSent[0]?.delivery?.[channel]?.lastAttemptedAt || recentSent[0]?.createdAt;
  const lastTs = new Date(lastAttemptedAt).getTime();
  if (Number.isNaN(lastTs)) return false;
  return Date.now() - lastTs < COOLDOWN_MS;
};

const resolveUserContact = async (db: any, userId: string) => {
  const row = await db.collection(USERS_COLLECTION).findOne({
    $or: [{ _id: toObjectId(userId) }, { id: userId }, { userId }]
  } as any, { projection: { _id: 1, email: 1, name: 1 } });

  return {
    email: row?.email ? String(row.email) : '',
    name: row?.name ? String(row.name) : ''
  };
};

const getCurrentAttempts = (notification: Notification, channel: ExternalChannel) => {
  const value = notification.delivery?.[channel]?.attempts;
  return Number.isFinite(value) ? Number(value) : 0;
};

const shouldAttemptRetryNow = (notification: Notification, channel: ExternalChannel) => {
  const nextRetryAt = notification.delivery?.[channel]?.nextRetryAt;
  if (!nextRetryAt) return true;
  const ts = new Date(nextRetryAt).getTime();
  if (Number.isNaN(ts)) return true;
  return ts <= Date.now();
};

const updateChannelStatus = async (
  db: any,
  notification: Notification,
  channel: ExternalChannel,
  payload: NotificationDeliveryStatus
) => {
  const setData: Record<string, any> = {
    [`delivery.${channel}.status`]: payload.status,
    [`delivery.${channel}.lastAttemptedAt`]: payload.lastAttemptedAt || nowIso()
  };

  if (typeof payload.lastErrorMessage === 'string') {
    setData[`delivery.${channel}.lastErrorMessage`] = payload.lastErrorMessage;
  }
  if (typeof payload.attempts === 'number') {
    setData[`delivery.${channel}.attempts`] = payload.attempts;
  }
  if (typeof payload.nextRetryAt === 'string') {
    setData[`delivery.${channel}.nextRetryAt`] = payload.nextRetryAt;
  }

  const unsetData: Record<string, any> = {};
  if (payload.nextRetryAt === undefined) {
    unsetData[`delivery.${channel}.nextRetryAt`] = '';
  }

  await db.collection(NOTIFICATIONS_COLLECTION).updateOne(
    { _id: toObjectId(notification.id) } as any,
    Object.keys(unsetData).length
      ? { $set: setData, $unset: unsetData }
      : { $set: setData }
  );
};

const suppressChannel = async (
  db: any,
  notification: Notification,
  watcher: Watcher,
  channel: ExternalChannel,
  reason: string,
  metricEvent: 'notification_suppressed' | 'notification_rate_limited' | 'notification_quiet_hours'
) => {
  await updateChannelStatus(db, notification, channel, {
    status: 'suppressed',
    lastAttemptedAt: nowIso(),
    lastErrorMessage: reason,
    attempts: getCurrentAttempts(notification, channel)
  });

  logDispatchEvent(metricEvent, {
    userId: notification.userId,
    watcherId: watcher.id,
    notificationId: notification.id,
    channel,
    status: 'suppressed',
    errorMessage: reason
  });
  emitMetric('notifications.suppressed', { channel, userId: notification.userId });
};

const getBackoffRetryAt = (attempts: number) => {
  const policy = getNotificationPolicy();
  const backoff = policy.retryBackoffMs * Math.max(1, 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + backoff).toISOString();
};

const failChannelWithRetry = async (
  db: any,
  notification: Notification,
  watcher: Watcher,
  channel: ExternalChannel,
  errorMessage: string
) => {
  const policy = getNotificationPolicy();
  const attempts = getCurrentAttempts(notification, channel) + 1;
  const hasRetry = attempts < policy.retryMaxAttempts;
  const nextRetryAt = hasRetry ? getBackoffRetryAt(attempts) : undefined;

  await updateChannelStatus(db, notification, channel, {
    status: 'failed',
    lastAttemptedAt: nowIso(),
    lastErrorMessage: hasRetry ? errorMessage : `${errorMessage} Max retry attempts reached.`,
    attempts,
    nextRetryAt
  });

  logDispatchEvent('notification_dispatch_failure', {
    userId: notification.userId,
    watcherId: watcher.id,
    notificationId: notification.id,
    channel,
    status: 'failed',
    errorMessage
  });

  emitMetric(`notifications.failed.${channel}`, { userId: notification.userId });
  if (hasRetry) {
    emitMetric('notifications.retried', { channel, userId: notification.userId, attempts });
  }
};

const shouldRetryThisChannel = (notification: Notification, channel: ExternalChannel, retryFailedOnly: boolean) => {
  if (!retryFailedOnly) return true;
  const status = notification.delivery?.[channel]?.status;
  if (status !== 'failed') return false;
  return shouldAttemptRetryNow(notification, channel);
};

const queueDigestForSuppressed = async (notification: Notification, watcher: Watcher) => {
  const digestEnabled = watcher.deliveryPreferences?.digest?.enabled === true;
  if (!digestEnabled) return false;
  await enqueueNotificationForDigest({
    userId: notification.userId,
    notificationId: notification.id,
    watcherId: watcher.id,
    digestFrequency: watcher.deliveryPreferences?.digest?.frequency || 'daily'
  });
  return true;
};

const canDispatchExternal = async (
  db: any,
  notification: Notification,
  watcher: Watcher,
  channel: ExternalChannel,
  options: DispatchOptions
) => {
  if (!channelEnabled(watcher.deliveryPreferences, channel)) {
    await suppressChannel(db, notification, watcher, channel, `${channel} delivery disabled by watcher preferences.`, 'notification_suppressed');
    return false;
  }

  if (!options.forceDeliver && !severityAllowed(notification, watcher, channel)) {
    await suppressChannel(db, notification, watcher, channel, 'Suppressed by severityMin preference.', 'notification_suppressed');
    return false;
  }

  if (!options.forceDeliver) {
    const suppressedByCooldown = await shouldSuppressByCooldown(db, notification, channel);
    if (suppressedByCooldown) {
      await suppressChannel(db, notification, watcher, channel, 'Suppressed by cooldown window.', 'notification_suppressed');
      return false;
    }

    if (isWithinQuietHours(new Date())) {
      await suppressChannel(db, notification, watcher, channel, 'Suppressed due to quiet hours.', 'notification_quiet_hours');
      await queueDigestForSuppressed(notification, watcher);
      return false;
    }

    const rateLimit = await isRateLimitedForUser(notification.userId);
    if (rateLimit.limited) {
      await suppressChannel(
        db,
        notification,
        watcher,
        channel,
        `Suppressed by rate limit (${rateLimit.count}/${rateLimit.limit} in last hour).`,
        'notification_rate_limited'
      );
      await queueDigestForSuppressed(notification, watcher);
      return false;
    }
  }

  return true;
};

const dispatchEmail = async (db: any, watcher: Watcher, notification: Notification, options: DispatchOptions) => {
  const channel: ExternalChannel = 'email';
  if (!shouldRetryThisChannel(notification, channel, Boolean(options.retryFailedOnly))) return;

  const allowed = await canDispatchExternal(db, notification, watcher, channel, options);
  if (!allowed) return;

  const contact = await resolveUserContact(db, notification.userId);
  if (!contact.email) {
    await failChannelWithRetry(db, notification, watcher, channel, 'User email not found.');
    return;
  }

  logDispatchEvent('notification_dispatch_attempt', {
    userId: notification.userId,
    watcherId: watcher.id,
    notificationId: notification.id,
    channel,
    status: 'attempt'
  });

  const email = await sendNotificationEmail({
    to: contact.email,
    userName: contact.name,
    appUrl: process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL,
    notification
  });

  if (email.ok) {
    await updateChannelStatus(db, notification, channel, {
      status: 'sent',
      lastAttemptedAt: nowIso(),
      lastErrorMessage: '',
      attempts: getCurrentAttempts(notification, channel) + 1
    });
    logDispatchEvent('notification_dispatch_success', {
      userId: notification.userId,
      watcherId: watcher.id,
      notificationId: notification.id,
      channel,
      status: 'sent'
    });
    emitMetric('notifications.sent.email', { userId: notification.userId });
    return;
  }

  const errorMessage = 'error' in email ? email.error : 'Email dispatch failed.';
  await failChannelWithRetry(db, notification, watcher, channel, errorMessage);
};

const dispatchSlack = async (db: any, watcher: Watcher, notification: Notification, options: DispatchOptions) => {
  const channel: ExternalChannel = 'slack';
  if (!shouldRetryThisChannel(notification, channel, Boolean(options.retryFailedOnly))) return;

  const allowed = await canDispatchExternal(db, notification, watcher, channel, options);
  if (!allowed) return;

  const webhookUrl = String(watcher.deliveryPreferences?.slack?.webhookUrl || '').trim();
  if (!webhookUrl) {
    await failChannelWithRetry(db, notification, watcher, channel, 'Slack webhook URL missing in watcher preferences.');
    return;
  }

  logDispatchEvent('notification_dispatch_attempt', {
    userId: notification.userId,
    watcherId: watcher.id,
    notificationId: notification.id,
    channel,
    status: 'attempt'
  });

  try {
    await sendSlackNotification(webhookUrl, notification, process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL);
    await updateChannelStatus(db, notification, channel, {
      status: 'sent',
      lastAttemptedAt: nowIso(),
      lastErrorMessage: '',
      attempts: getCurrentAttempts(notification, channel) + 1
    });
    logDispatchEvent('notification_dispatch_success', {
      userId: notification.userId,
      watcherId: watcher.id,
      notificationId: notification.id,
      channel,
      status: 'sent'
    });
    emitMetric('notifications.sent.slack', { userId: notification.userId });
  } catch (error) {
    await failChannelWithRetry(db, notification, watcher, channel, (error as Error).message || 'Unknown Slack dispatch error.');
  }
};

const dispatchTeams = async (db: any, watcher: Watcher, notification: Notification, options: DispatchOptions) => {
  const channel: ExternalChannel = 'teams';
  if (!shouldRetryThisChannel(notification, channel, Boolean(options.retryFailedOnly))) return;

  const allowed = await canDispatchExternal(db, notification, watcher, channel, options);
  if (!allowed) return;

  const webhookUrl = String(watcher.deliveryPreferences?.teams?.webhookUrl || '').trim();
  if (!webhookUrl) {
    await failChannelWithRetry(db, notification, watcher, channel, 'Teams webhook URL missing in watcher preferences.');
    return;
  }

  logDispatchEvent('notification_dispatch_attempt', {
    userId: notification.userId,
    watcherId: watcher.id,
    notificationId: notification.id,
    channel,
    status: 'attempt'
  });

  try {
    await sendTeamsNotification(webhookUrl, notification, process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL);
    await updateChannelStatus(db, notification, channel, {
      status: 'sent',
      lastAttemptedAt: nowIso(),
      lastErrorMessage: '',
      attempts: getCurrentAttempts(notification, channel) + 1
    });
    logDispatchEvent('notification_dispatch_success', {
      userId: notification.userId,
      watcherId: watcher.id,
      notificationId: notification.id,
      channel,
      status: 'sent'
    });
    emitMetric('notifications.sent.teams', { userId: notification.userId });
  } catch (error) {
    await failChannelWithRetry(db, notification, watcher, channel, (error as Error).message || 'Unknown Teams dispatch error.');
  }
};

const applyDigestMode = async (db: any, notification: Notification, watcher: Watcher) => {
  await db.collection(NOTIFICATIONS_COLLECTION).updateOne(
    { _id: toObjectId(notification.id) } as any,
    {
      $set: {
        deliveryMode: 'digest',
        'delivery.email.status': 'suppressed',
        'delivery.email.lastAttemptedAt': nowIso(),
        'delivery.email.lastErrorMessage': 'Suppressed due to digest mode.',
        'delivery.slack.status': 'suppressed',
        'delivery.slack.lastAttemptedAt': nowIso(),
        'delivery.slack.lastErrorMessage': 'Suppressed due to digest mode.',
        'delivery.teams.status': 'suppressed',
        'delivery.teams.lastAttemptedAt': nowIso(),
        'delivery.teams.lastErrorMessage': 'Suppressed due to digest mode.'
      }
    }
  );

  await enqueueNotificationForDigest({
    userId: notification.userId,
    notificationId: notification.id,
    watcherId: watcher.id,
    digestFrequency: watcher.deliveryPreferences?.digest?.frequency || 'daily'
  });
};

export const dispatchNotification = async (notificationId: string, options: DispatchOptions = {}) => {
  startDigestScheduler();
  startNotificationRetryScheduler(async (id) => {
    await dispatchNotification(id, { retryFailedOnly: true });
  });

  const db = await getDb();
  const raw = await db.collection(NOTIFICATIONS_COLLECTION).findOne({ _id: toObjectId(notificationId) } as any);
  if (!raw) return;
  const notification = normalizeNotification(raw);

  const watcherRaw = await db.collection(WATCHERS_COLLECTION).findOne({ _id: toObjectId(notification.watcherId) } as any);
  if (!watcherRaw) {
    for (const channel of CHANNELS) {
      await updateChannelStatus(db, notification, channel, {
        status: 'failed',
        lastAttemptedAt: nowIso(),
        lastErrorMessage: 'Watcher not found for notification.',
        attempts: getCurrentAttempts(notification, channel) + 1
      });
    }
    return;
  }

  const watcher = normalizeWatcher(watcherRaw);
  if (!watcher.enabled) {
    for (const channel of CHANNELS) {
      await suppressChannel(db, notification, watcher, channel, 'Watcher disabled.', 'notification_suppressed');
    }
    return;
  }

  const digestEnabled = watcher.deliveryPreferences?.digest?.enabled === true;
  if (digestEnabled && !options.forceDeliver) {
    await applyDigestMode(db, notification, watcher);
    return;
  }

  await db.collection(NOTIFICATIONS_COLLECTION).updateOne(
    { _id: toObjectId(notification.id) } as any,
    { $set: { deliveryMode: 'immediate' } }
  );

  await Promise.all([
    dispatchEmail(db, watcher, notification, options),
    dispatchSlack(db, watcher, notification, options),
    dispatchTeams(db, watcher, notification, options)
  ]);
};

export const dispatchDueNotificationRetries = async () => {
  await processNotificationRetries(async (id: string) => {
    await dispatchNotification(id, { retryFailedOnly: true });
  });
};
