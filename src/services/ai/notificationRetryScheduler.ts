import { getNotificationPolicy } from './notificationPolicy';
import { clearAiNotificationChannelRetryState, listAiNotificationsNeedingRetry } from '../../server/db/repositories/aiNotificationsRepo';

const CHANNELS = ['email', 'slack', 'teams'] as const;

type DispatchRetryFn = (notificationId: string) => Promise<void>;

let schedulerStarted = false;
let schedulerHandle: NodeJS.Timeout | null = null;

export const processNotificationRetries = async (dispatchRetry: DispatchRetryFn, maxRows = 100) => {
  const policy = getNotificationPolicy();
  const nowIso = new Date().toISOString();
  const rows = await listAiNotificationsNeedingRetry(maxRows, policy.retryMaxAttempts, nowIso);

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
  await clearAiNotificationChannelRetryState(notificationId, channel);
};
