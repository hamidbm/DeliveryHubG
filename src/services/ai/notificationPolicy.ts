import { getDb } from '../db';

const WATCHERS_COLLECTION = 'ai_watchers';
const NOTIFICATIONS_COLLECTION = 'ai_notifications';

export type NotificationPolicy = {
  maxWatchersPerUser: number;
  maxNotificationsPerUserPerHour: number;
  maxDigestItems: number;
  retryMaxAttempts: number;
  retryBackoffMs: number;
  quietHoursStart: string;
  quietHoursEnd: string;
};

const parseIntWithDefault = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const parseTime = (value: string, fallback: string) => {
  const source = String(value || fallback).trim();
  const match = source.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return fallback;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

export const getNotificationPolicy = (): NotificationPolicy => ({
  maxWatchersPerUser: parseIntWithDefault(process.env.MAX_WATCHERS_PER_USER, 100),
  maxNotificationsPerUserPerHour: parseIntWithDefault(process.env.MAX_NOTIFICATIONS_PER_USER_PER_HOUR, 200),
  maxDigestItems: parseIntWithDefault(process.env.MAX_DIGEST_ITEMS, 50),
  retryMaxAttempts: parseIntWithDefault(process.env.NOTIFICATION_RETRY_MAX_ATTEMPTS, 3),
  retryBackoffMs: parseIntWithDefault(process.env.NOTIFICATION_RETRY_BACKOFF_MS, 60_000),
  quietHoursStart: parseTime(String(process.env.QUIET_HOURS_START || '22:00'), '22:00'),
  quietHoursEnd: parseTime(String(process.env.QUIET_HOURS_END || '07:00'), '07:00')
});

const minutesFromHHMM = (value: string) => {
  const [hh, mm] = value.split(':').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
};

export const isWithinQuietHours = (at = new Date(), policy = getNotificationPolicy()) => {
  const startMin = minutesFromHHMM(policy.quietHoursStart);
  const endMin = minutesFromHHMM(policy.quietHoursEnd);
  if (startMin === null || endMin === null) return false;

  const nowMin = at.getHours() * 60 + at.getMinutes();
  if (startMin === endMin) return false;
  if (startMin < endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  return nowMin >= startMin || nowMin < endMin;
};

export const getWatcherUsageForUser = async (userId: string) => {
  const db = await getDb();
  const policy = getNotificationPolicy();
  const used = await db.collection(WATCHERS_COLLECTION).countDocuments({ userId: String(userId) });
  return { used, max: policy.maxWatchersPerUser };
};

export const enforceWatcherQuota = async (userId: string) => {
  const usage = await getWatcherUsageForUser(userId);
  if (usage.used >= usage.max) {
    const error = new Error('Watcher quota exceeded');
    (error as any).code = 'WATCHER_QUOTA_EXCEEDED';
    throw error;
  }
  return usage;
};

export const isRateLimitedForUser = async (userId: string, policy = getNotificationPolicy()) => {
  const db = await getDb();
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const count = await db.collection(NOTIFICATIONS_COLLECTION).countDocuments({
    userId: String(userId),
    createdAt: { $gte: sinceIso }
  });
  return {
    limited: count >= policy.maxNotificationsPerUserPerHour,
    count,
    limit: policy.maxNotificationsPerUserPerHour
  };
};
