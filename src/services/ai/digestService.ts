import { ObjectId } from 'mongodb';
import { Notification, NotificationDigestItem } from '../../types/ai';
import { getDb } from '../db';
import { sendNotificationEmail } from './emailChannel';
import { sendSlackNotification } from './slackChannel';
import { sendTeamsNotification } from './teamsChannel';

const QUEUE_COLLECTION = 'ai_notification_digest_queue';
const NOTIFICATIONS_COLLECTION = 'ai_notifications';
const WATCHERS_COLLECTION = 'ai_watchers';
const USERS_COLLECTION = 'users';

let schedulerStarted = false;
let schedulerHandle: NodeJS.Timeout | null = null;

const toObjectId = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : id);

const nowIso = () => new Date().toISOString();

const toDigestItem = (row: any): NotificationDigestItem => ({
  id: String(row._id || row.id || ''),
  userId: String(row.userId || ''),
  notificationId: String(row.notificationId || ''),
  watcherId: row.watcherId ? String(row.watcherId) : undefined,
  createdAt: String(row.createdAt || nowIso())
});

const ensureIndexes = async (db: any) => {
  await db.collection(QUEUE_COLLECTION).createIndex({ userId: 1, createdAt: 1 });
  await db.collection(QUEUE_COLLECTION).createIndex({ notificationId: 1 }, { unique: true });
};

export const enqueueNotificationForDigest = async (input: {
  userId: string;
  notificationId: string;
  watcherId?: string;
}) => {
  const db = await getDb();
  await ensureIndexes(db);

  try {
    await db.collection(QUEUE_COLLECTION).insertOne({
      userId: String(input.userId),
      notificationId: String(input.notificationId),
      watcherId: input.watcherId ? String(input.watcherId) : undefined,
      createdAt: nowIso()
    });
  } catch {
    // duplicate queue entries are ignored
  }
};

const buildDigestSummary = (notifications: Notification[]) => {
  const alerts = notifications.filter((n) => n.title.toLowerCase().includes('alert'));
  const trends = notifications.filter((n) => n.title.toLowerCase().includes('trend'));
  const investigations = notifications.filter((n) => n.title.toLowerCase().includes('investigation'));

  const lines = [
    'DeliveryHub Digest',
    '',
    `Total notifications: ${notifications.length}`,
    '',
    alerts.length ? 'Alerts:' : '',
    ...alerts.slice(0, 8).map((n) => `- ${n.title}`),
    '',
    trends.length ? 'Trend Changes:' : '',
    ...trends.slice(0, 8).map((n) => `- ${n.title}`),
    '',
    investigations.length ? 'Investigations Updated:' : '',
    ...investigations.slice(0, 8).map((n) => `- ${n.title}`),
    '',
    ...notifications.slice(0, 8).map((n) => `• ${n.title}: ${n.message}`)
  ].filter(Boolean);

  return lines.join('\n');
};

const shouldSendNowByFrequency = (
  items: NotificationDigestItem[],
  frequency: 'hourly' | 'daily'
) => {
  const oldest = items
    .map((item) => new Date(item.createdAt).getTime())
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b)[0];
  if (!oldest) return false;
  const elapsed = Date.now() - oldest;
  const threshold = frequency === 'daily'
    ? 24 * 60 * 60 * 1000
    : 60 * 60 * 1000;
  return elapsed >= threshold;
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

const getWatcherPreferencesForUser = async (db: any, userId: string) => {
  const rows = await db.collection(WATCHERS_COLLECTION)
    .find({ userId: String(userId), enabled: true, 'deliveryPreferences.digest.enabled': true })
    .toArray();
  return rows;
};

export const processDigestQueue = async () => {
  if (String(process.env.NOTIFICATION_DIGEST_ENABLED || 'false').toLowerCase() !== 'true') return;

  const db = await getDb();
  await ensureIndexes(db);

  const queueRows = await db.collection(QUEUE_COLLECTION).find({}).sort({ createdAt: 1 }).limit(1000).toArray();
  if (!queueRows.length) return;

  const grouped = new Map<string, NotificationDigestItem[]>();
  queueRows.map(toDigestItem).forEach((item) => {
    const arr = grouped.get(item.userId) || [];
    arr.push(item);
    grouped.set(item.userId, arr);
  });

  for (const [userId, items] of grouped.entries()) {
    const notificationRows = await db.collection(NOTIFICATIONS_COLLECTION)
      .find({ _id: { $in: items.map((item) => toObjectId(item.notificationId)) } } as any)
      .toArray();

    if (!notificationRows.length) {
      await db.collection(QUEUE_COLLECTION).deleteMany({ _id: { $in: items.map((item) => toObjectId(item.id)) } } as any);
      continue;
    }

    const notifications = notificationRows.map((row: any) => ({
      id: String(row._id || ''),
      watcherId: String(row.watcherId || ''),
      userId: String(row.userId || ''),
      title: String(row.title || ''),
      message: String(row.message || ''),
      severity: row.severity,
      relatedEntities: Array.isArray(row.relatedEntities) ? row.relatedEntities : [],
      relatedInvestigationId: row.relatedInvestigationId ? String(row.relatedInvestigationId) : undefined,
      createdAt: String(row.createdAt || nowIso()),
      read: Boolean(row.read),
      delivery: row.delivery || undefined
    })) as Notification[];

    const digestWatchers = await getWatcherPreferencesForUser(db, userId);
    if (!digestWatchers.length) {
      await db.collection(QUEUE_COLLECTION).deleteMany({ _id: { $in: items.map((item) => toObjectId(item.id)) } } as any);
      continue;
    }

    const firstPref = digestWatchers[0]?.deliveryPreferences || {};
    const frequency: 'hourly' | 'daily' = firstPref?.digest?.frequency === 'hourly' ? 'hourly' : 'daily';
    if (!shouldSendNowByFrequency(items, frequency)) {
      continue;
    }
    const summary = buildDigestSummary(notifications);
    const synthetic: Notification = {
      id: `digest-${userId}-${Date.now()}`,
      watcherId: String(digestWatchers[0]?._id || ''),
      userId,
      title: `DeliveryHub ${String(frequency)} digest`,
      message: summary,
      createdAt: nowIso(),
      read: true,
      deliveryMode: 'digest',
      delivery: {
        in_app: {
          status: 'sent',
          deliveredAt: nowIso()
        }
      }
    };

    const appUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL;
    const contact = await resolveUserContact(db, userId);

    if (firstPref?.email?.enabled && contact.email) {
      try {
        await sendNotificationEmail({
          to: contact.email,
          userName: contact.name,
          appUrl,
          notification: synthetic
        });
      } catch {
        // keep processing remaining channels
      }
    }

    if (firstPref?.slack?.enabled && firstPref?.slack?.webhookUrl) {
      try {
        await sendSlackNotification(String(firstPref.slack.webhookUrl), synthetic, appUrl);
      } catch {
        // keep processing remaining channels
      }
    }

    if (firstPref?.teams?.enabled && firstPref?.teams?.webhookUrl) {
      try {
        await sendTeamsNotification(String(firstPref.teams.webhookUrl), synthetic, appUrl);
      } catch {
        // keep processing remaining channels
      }
    }

    await db.collection(QUEUE_COLLECTION).deleteMany({ _id: { $in: items.map((item) => toObjectId(item.id)) } } as any);
  }
};

export const startDigestScheduler = () => {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const enabled = String(process.env.NOTIFICATION_DIGEST_ENABLED || 'false').toLowerCase() === 'true';
  if (!enabled) return;

  const minutes = Math.max(1, Number(process.env.DIGEST_INTERVAL_MINUTES || 60));
  schedulerHandle = setInterval(() => {
    void processDigestQueue();
  }, minutes * 60 * 1000);
};

export const stopDigestScheduler = () => {
  if (schedulerHandle) clearInterval(schedulerHandle);
  schedulerHandle = null;
  schedulerStarted = false;
};
