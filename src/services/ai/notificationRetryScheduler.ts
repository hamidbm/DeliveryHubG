import { ObjectId } from 'mongodb';
import { getDb } from '../db';
import { getNotificationPolicy } from './notificationPolicy';

const NOTIFICATIONS_COLLECTION = 'ai_notifications';
const CHANNELS = ['email', 'slack', 'teams'] as const;

type DispatchRetryFn = (notificationId: string) => Promise<void>;

let schedulerStarted = false;
let schedulerHandle: NodeJS.Timeout | null = null;

const toObjectId = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : id);

export const processNotificationRetries = async (dispatchRetry: DispatchRetryFn, maxRows = 100) => {
  const policy = getNotificationPolicy();
  const db = await getDb();
  const nowIso = new Date().toISOString();

  const retryFilter = {
    $or: CHANNELS.map((channel) => ({
      [`delivery.${channel}.status`]: 'failed',
      [`delivery.${channel}.nextRetryAt`]: { $lte: nowIso },
      [`delivery.${channel}.attempts`]: { $lt: policy.retryMaxAttempts }
    }))
  };

  const rows = await db.collection(NOTIFICATIONS_COLLECTION)
    .find(retryFilter as any, { projection: { _id: 1 } })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(maxRows, 500)))
    .toArray();

  for (const row of rows) {
    await dispatchRetry(String(row._id));
  }
};

export const startNotificationRetryScheduler = (dispatchRetry: DispatchRetryFn) => {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const policy = getNotificationPolicy();
  const intervalMs = Math.max(15_000, Math.min(policy.retryBackoffMs, 120_000));
  schedulerHandle = setInterval(() => {
    void processNotificationRetries(dispatchRetry).catch(() => {
      // Best-effort retry scheduler.
    });
  }, intervalMs);
};

export const stopNotificationRetryScheduler = () => {
  if (schedulerHandle) clearInterval(schedulerHandle);
  schedulerHandle = null;
  schedulerStarted = false;
};

export const clearChannelRetryState = async (notificationId: string, channel: (typeof CHANNELS)[number]) => {
  const db = await getDb();
  await db.collection(NOTIFICATIONS_COLLECTION).updateOne(
    { _id: toObjectId(notificationId) } as any,
    {
      $unset: {
        [`delivery.${channel}.nextRetryAt`]: ''
      }
    }
  );
};
