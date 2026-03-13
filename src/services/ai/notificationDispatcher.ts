import { ObjectId } from 'mongodb';
import { Notification, NotificationDeliveryStatus, PortfolioRiskSeverity, Watcher, WatcherDeliveryPreferences } from '../../types/ai';
import { getDb } from '../db';
import { sendNotificationEmail } from './emailChannel';
import { sendSlackNotification } from './slackChannel';
import { sendTeamsNotification } from './teamsChannel';
import { enqueueNotificationForDigest, startDigestScheduler } from './digestService';

const WATCHERS_COLLECTION = 'ai_watchers';
const NOTIFICATIONS_COLLECTION = 'ai_notifications';
const USERS_COLLECTION = 'users';
const COOLDOWN_MS = 30 * 60 * 1000;

const toObjectId = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : id);

const severityRank: Record<PortfolioRiskSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

type ExternalChannel = 'email' | 'slack' | 'teams';

const normalizeWatcher = (row: any): Watcher => ({
  id: String(row._id || row.id || ''),
  userId: String(row.userId || ''),
  type: row.type,
  targetId: String(row.targetId || ''),
  condition: row.condition || {},
  deliveryPreferences: row.deliveryPreferences || undefined,
  enabled: row.enabled !== false,
  createdAt: String(row.createdAt || new Date().toISOString()),
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
  createdAt: String(row.createdAt || new Date().toISOString()),
  read: Boolean(row.read),
  deliveryMode: row.deliveryMode || 'immediate',
  delivery: row.delivery || undefined
});

const channelSeverityMin = (preferences: WatcherDeliveryPreferences | undefined, channel: ExternalChannel) => {
  if (channel === 'email') return preferences?.email?.severityMin;
  if (channel === 'slack') return preferences?.slack?.severityMin;
  return preferences?.teams?.severityMin;
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

const updateChannelStatus = async (
  db: any,
  notificationId: string,
  channel: ExternalChannel,
  payload: NotificationDeliveryStatus
) => {
  await db.collection(NOTIFICATIONS_COLLECTION).updateOne(
    { _id: toObjectId(notificationId) } as any,
    {
      $set: {
        [`delivery.${channel}.status`]: payload.status,
        ...(payload.lastAttemptedAt ? { [`delivery.${channel}.lastAttemptedAt`]: payload.lastAttemptedAt } : {}),
        ...(typeof payload.lastErrorMessage === 'string'
          ? { [`delivery.${channel}.lastErrorMessage`]: payload.lastErrorMessage }
          : {})
      }
    }
  );
};

const dispatchEmail = async (db: any, watcher: Watcher, notification: Notification) => {
  const emailEnabled = watcher.deliveryPreferences?.email?.enabled === true;
  if (!emailEnabled) {
    await updateChannelStatus(db, notification.id, 'email', {
      status: 'suppressed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: 'Email delivery disabled by watcher preferences.'
    });
    return;
  }

  if (!severityAllowed(notification, watcher, 'email')) {
    await updateChannelStatus(db, notification.id, 'email', {
      status: 'suppressed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: 'Suppressed by severityMin preference.'
    });
    return;
  }

  const suppressed = await shouldSuppressByCooldown(db, notification, 'email');
  if (suppressed) {
    await updateChannelStatus(db, notification.id, 'email', {
      status: 'suppressed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: 'Suppressed by cooldown window.'
    });
    return;
  }

  const contact = await resolveUserContact(db, notification.userId);
  if (!contact.email) {
    await updateChannelStatus(db, notification.id, 'email', {
      status: 'failed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: 'User email not found.'
    });
    return;
  }

  const email = await sendNotificationEmail({
    to: contact.email,
    userName: contact.name,
    appUrl: process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL,
    notification
  });

  if (email.ok) {
    await updateChannelStatus(db, notification.id, 'email', {
      status: 'sent',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: ''
    });
  } else {
    await updateChannelStatus(db, notification.id, 'email', {
      status: 'failed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: 'error' in email ? email.error : 'Unknown email dispatch error.'
    });
  }
};

const dispatchSlack = async (db: any, watcher: Watcher, notification: Notification) => {
  const pref = watcher.deliveryPreferences?.slack;
  if (!pref?.enabled) {
    await updateChannelStatus(db, notification.id, 'slack', {
      status: 'suppressed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: 'Slack delivery disabled by watcher preferences.'
    });
    return;
  }

  if (!pref.webhookUrl) {
    await updateChannelStatus(db, notification.id, 'slack', {
      status: 'failed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: 'Slack webhook URL missing in watcher preferences.'
    });
    return;
  }

  if (!severityAllowed(notification, watcher, 'slack')) {
    await updateChannelStatus(db, notification.id, 'slack', {
      status: 'suppressed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: 'Suppressed by severityMin preference.'
    });
    return;
  }

  const suppressed = await shouldSuppressByCooldown(db, notification, 'slack');
  if (suppressed) {
    await updateChannelStatus(db, notification.id, 'slack', {
      status: 'suppressed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: 'Suppressed by cooldown window.'
    });
    return;
  }

  try {
    await sendSlackNotification(pref.webhookUrl, notification, process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL);
    await updateChannelStatus(db, notification.id, 'slack', {
      status: 'sent',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: ''
    });
  } catch (error) {
    await updateChannelStatus(db, notification.id, 'slack', {
      status: 'failed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: (error as Error).message || 'Unknown Slack dispatch error.'
    });
  }
};

const dispatchTeams = async (db: any, watcher: Watcher, notification: Notification) => {
  const pref = watcher.deliveryPreferences?.teams;
  if (!pref?.enabled) {
    await updateChannelStatus(db, notification.id, 'teams', {
      status: 'suppressed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: 'Teams delivery disabled by watcher preferences.'
    });
    return;
  }

  if (!pref.webhookUrl) {
    await updateChannelStatus(db, notification.id, 'teams', {
      status: 'failed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: 'Teams webhook URL missing in watcher preferences.'
    });
    return;
  }

  if (!severityAllowed(notification, watcher, 'teams')) {
    await updateChannelStatus(db, notification.id, 'teams', {
      status: 'suppressed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: 'Suppressed by severityMin preference.'
    });
    return;
  }

  const suppressed = await shouldSuppressByCooldown(db, notification, 'teams');
  if (suppressed) {
    await updateChannelStatus(db, notification.id, 'teams', {
      status: 'suppressed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: 'Suppressed by cooldown window.'
    });
    return;
  }

  try {
    await sendTeamsNotification(pref.webhookUrl, notification, process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL);
    await updateChannelStatus(db, notification.id, 'teams', {
      status: 'sent',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: ''
    });
  } catch (error) {
    await updateChannelStatus(db, notification.id, 'teams', {
      status: 'failed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: (error as Error).message || 'Unknown Teams dispatch error.'
    });
  }
};

export const dispatchNotification = async (notificationId: string) => {
  startDigestScheduler();

  const db = await getDb();
  const raw = await db.collection(NOTIFICATIONS_COLLECTION).findOne({ _id: toObjectId(notificationId) } as any);
  if (!raw) return;
  const notification = normalizeNotification(raw);

  const watcherRaw = await db.collection(WATCHERS_COLLECTION).findOne({ _id: toObjectId(notification.watcherId) } as any);
  if (!watcherRaw) {
    await updateChannelStatus(db, notification.id, 'email', {
      status: 'failed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: 'Watcher not found for notification.'
    });
    await updateChannelStatus(db, notification.id, 'slack', {
      status: 'failed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: 'Watcher not found for notification.'
    });
    await updateChannelStatus(db, notification.id, 'teams', {
      status: 'failed',
      lastAttemptedAt: new Date().toISOString(),
      lastErrorMessage: 'Watcher not found for notification.'
    });
    return;
  }

  const watcher = normalizeWatcher(watcherRaw);
  const digestEnabled = watcher.deliveryPreferences?.digest?.enabled === true;

  if (digestEnabled) {
    await db.collection(NOTIFICATIONS_COLLECTION).updateOne(
      { _id: toObjectId(notification.id) } as any,
      {
        $set: {
          deliveryMode: 'digest',
          'delivery.email.status': 'suppressed',
          'delivery.email.lastAttemptedAt': new Date().toISOString(),
          'delivery.email.lastErrorMessage': 'Suppressed due to digest mode.',
          'delivery.slack.status': 'suppressed',
          'delivery.slack.lastAttemptedAt': new Date().toISOString(),
          'delivery.slack.lastErrorMessage': 'Suppressed due to digest mode.',
          'delivery.teams.status': 'suppressed',
          'delivery.teams.lastAttemptedAt': new Date().toISOString(),
          'delivery.teams.lastErrorMessage': 'Suppressed due to digest mode.'
        }
      }
    );

    await enqueueNotificationForDigest({
      userId: notification.userId,
      notificationId: notification.id,
      watcherId: watcher.id
    });
    return;
  }

  await db.collection(NOTIFICATIONS_COLLECTION).updateOne(
    { _id: toObjectId(notification.id) } as any,
    { $set: { deliveryMode: 'immediate' } }
  );

  await Promise.all([
    dispatchEmail(db, watcher, notification),
    dispatchSlack(db, watcher, notification),
    dispatchTeams(db, watcher, notification)
  ]);
};
