import { Notification, NotificationDeliveryStatus, PortfolioRiskSeverity, Watcher, WatcherDeliveryPreferences } from '../../types/ai';
import { sendNotificationEmail } from './emailChannel';
import { sendSlackNotification } from './slackChannel';
import { sendTeamsNotification } from './teamsChannel';
import { enqueueNotificationForDigest, startDigestScheduler } from './digestService';
import { getNotificationPolicy, isRateLimitedForUser, isWithinQuietHours } from './notificationPolicy';
import { processNotificationRetries, startNotificationRetryScheduler } from './notificationRetryScheduler';
import {
  findUserContactByAnyId,
  getAiNotificationByIdRecord,
  getAiWatcherByIdRecord,
  listRecentDeliveredAiNotificationsForWatcherChannel,
  updateAiNotificationRecord
} from '../../server/db/repositories/aiNotificationsRepo';

const COOLDOWN_MS = 30 * 60 * 1000;

const CHANNELS = ['email', 'slack', 'teams'] as const;
type ExternalChannel = (typeof CHANNELS)[number];

type DispatchOptions = {
  retryFailedOnly?: boolean;
  forceDeliver?: boolean;
};

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

const shouldSuppressByCooldown = async (notification: Notification, channel: ExternalChannel) => {
  const recentSent = await listRecentDeliveredAiNotificationsForWatcherChannel(
    notification.userId,
    notification.watcherId,
    notification.id,
    channel,
    1
  );

  if (!recentSent.length) return false;
  const lastAttemptedAt = recentSent[0]?.delivery?.[channel]?.lastAttemptedAt || recentSent[0]?.createdAt;
  const lastTs = new Date(lastAttemptedAt).getTime();
  if (Number.isNaN(lastTs)) return false;
  return Date.now() - lastTs < COOLDOWN_MS;
};

const resolveUserContact = async (userId: string) => {
  const row = await findUserContactByAnyId(userId);

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

const updateChannelStatus = async (notification: Notification, channel: ExternalChannel, payload: NotificationDeliveryStatus) => {
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

  await updateAiNotificationRecord(notification.id, setData, Object.keys(unsetData).length ? unsetData : undefined);
};

const suppressChannel = async (
  notification: Notification,
  watcher: Watcher,
  channel: ExternalChannel,
  reason: string,
  metricEvent: 'notification_suppressed' | 'notification_rate_limited' | 'notification_quiet_hours'
) => {
  await updateChannelStatus(notification, channel, {
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
  notification: Notification,
  watcher: Watcher,
  channel: ExternalChannel,
  errorMessage: string
) => {
  const policy = getNotificationPolicy();
  const attempts = getCurrentAttempts(notification, channel) + 1;
  const hasRetry = attempts < policy.retryMaxAttempts;
  const nextRetryAt = hasRetry ? getBackoffRetryAt(attempts) : undefined;

  await updateChannelStatus(notification, channel, {
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
  notification: Notification,
  watcher: Watcher,
  channel: ExternalChannel,
  options: DispatchOptions
) => {
  if (!channelEnabled(watcher.deliveryPreferences, channel)) {
    await suppressChannel(notification, watcher, channel, `${channel} delivery disabled by watcher preferences.`, 'notification_suppressed');
    return false;
  }

  if (!options.forceDeliver && !severityAllowed(notification, watcher, channel)) {
    await suppressChannel(notification, watcher, channel, 'Suppressed by severityMin preference.', 'notification_suppressed');
    return false;
  }

  if (!options.forceDeliver) {
    const suppressedByCooldown = await shouldSuppressByCooldown(notification, channel);
    if (suppressedByCooldown) {
      await suppressChannel(notification, watcher, channel, 'Suppressed by cooldown window.', 'notification_suppressed');
      return false;
    }

    if (isWithinQuietHours(new Date())) {
      await suppressChannel(notification, watcher, channel, 'Suppressed due to quiet hours.', 'notification_quiet_hours');
      await queueDigestForSuppressed(notification, watcher);
      return false;
    }

    const rateLimit = await isRateLimitedForUser(notification.userId);
    if (rateLimit.limited) {
      await suppressChannel(
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

const dispatchEmail = async (watcher: Watcher, notification: Notification, options: DispatchOptions) => {
  const channel: ExternalChannel = 'email';
  if (!shouldRetryThisChannel(notification, channel, Boolean(options.retryFailedOnly))) return;

  const allowed = await canDispatchExternal(notification, watcher, channel, options);
  if (!allowed) return;

  const contact = await resolveUserContact(notification.userId);
  if (!contact.email) {
    await failChannelWithRetry(notification, watcher, channel, 'User email not found.');
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
    await updateChannelStatus(notification, channel, {
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
  await failChannelWithRetry(notification, watcher, channel, errorMessage);
};

const dispatchSlack = async (watcher: Watcher, notification: Notification, options: DispatchOptions) => {
  const channel: ExternalChannel = 'slack';
  if (!shouldRetryThisChannel(notification, channel, Boolean(options.retryFailedOnly))) return;

  const allowed = await canDispatchExternal(notification, watcher, channel, options);
  if (!allowed) return;

  const webhookUrl = String(watcher.deliveryPreferences?.slack?.webhookUrl || '').trim();
  if (!webhookUrl) {
    await failChannelWithRetry(notification, watcher, channel, 'Slack webhook URL missing in watcher preferences.');
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
    await updateChannelStatus(notification, channel, {
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
    await failChannelWithRetry(notification, watcher, channel, (error as Error).message || 'Unknown Slack dispatch error.');
  }
};

const dispatchTeams = async (watcher: Watcher, notification: Notification, options: DispatchOptions) => {
  const channel: ExternalChannel = 'teams';
  if (!shouldRetryThisChannel(notification, channel, Boolean(options.retryFailedOnly))) return;

  const allowed = await canDispatchExternal(notification, watcher, channel, options);
  if (!allowed) return;

  const webhookUrl = String(watcher.deliveryPreferences?.teams?.webhookUrl || '').trim();
  if (!webhookUrl) {
    await failChannelWithRetry(notification, watcher, channel, 'Teams webhook URL missing in watcher preferences.');
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
    await updateChannelStatus(notification, channel, {
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
    await failChannelWithRetry(notification, watcher, channel, (error as Error).message || 'Unknown Teams dispatch error.');
  }
};

const applyDigestMode = async (notification: Notification, watcher: Watcher) => {
  await updateAiNotificationRecord(notification.id, {
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
  });

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

  const raw = await getAiNotificationByIdRecord(notificationId);
  if (!raw) return;
  const notification = normalizeNotification(raw);

  const watcherRaw = await getAiWatcherByIdRecord(notification.watcherId);
  if (!watcherRaw) {
    for (const channel of CHANNELS) {
      await updateChannelStatus(notification, channel, {
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
      await suppressChannel(notification, watcher, channel, 'Watcher disabled.', 'notification_suppressed');
    }
    return;
  }

  const digestEnabled = watcher.deliveryPreferences?.digest?.enabled === true;
  if (digestEnabled && !options.forceDeliver) {
    await applyDigestMode(notification, watcher);
    return;
  }

  await updateAiNotificationRecord(notification.id, { deliveryMode: 'immediate' });

  await Promise.all([
    dispatchEmail(watcher, notification, options),
    dispatchSlack(watcher, notification, options),
    dispatchTeams(watcher, notification, options)
  ]);
};

export const dispatchDueNotificationRetries = async () => {
  await processNotificationRetries(async (id: string) => {
    await dispatchNotification(id, { retryFailedOnly: true });
  });
};
