import { getMongoClientPromise, getMongoDbName } from '../lib/mongodb';
import { getDeliveryPolicy, DeliveryPolicy } from './policy';
import { WorkItemStatus } from '../types';

const DEFAULT_SPRINT_LENGTH_DAYS = 14;

const getDb = async () => {
  const client = await getMongoClientPromise();
  return client.db(getMongoDbName());
};

export const computeBundleVelocity = async (bundleId: string, windowSprints = 5) => {
  const db = await getDb();
  const sprintWindow = Math.max(1, windowSprints || 5);

  const sprints = await db.collection('workitems_sprints')
    .find({ bundleId: String(bundleId), status: 'CLOSED' })
    .sort({ endDate: -1 })
    .limit(sprintWindow)
    .toArray();

  const now = Date.now();

  let items: any[] = [];
  let sampleSize = 0;
  let divisor = sprintWindow;
  let weeklySamples: number[] = [];
  let sprintLengthDays = DEFAULT_SPRINT_LENGTH_DAYS;

  if (sprints.length) {
    const sprintIds = sprints.map((s: any) => String(s._id || s.id || '')).filter(Boolean);
    divisor = sprints.length;
    items = await db.collection('workitems').find({
      bundleId: String(bundleId),
      sprintId: { $in: sprintIds },
      status: WorkItemStatus.DONE
    }).toArray();
    weeklySamples = sprints.map((s: any) => {
      const start = s.startDate ? new Date(s.startDate) : null;
      const end = s.endDate ? new Date(s.endDate) : null;
      const spanDays = start && end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))) : DEFAULT_SPRINT_LENGTH_DAYS;
      sprintLengthDays = spanDays;
      const sprintItems = items.filter((i: any) => String(i.sprintId) === String(s._id || s.id || ''));
      const sprintPoints = sprintItems.reduce((sum, i) => sum + (typeof i.storyPoints === 'number' ? i.storyPoints : 0), 0);
      const weeks = spanDays / 7;
      return weeks > 0 ? Number((sprintPoints / weeks).toFixed(2)) : 0;
    }).filter((v: number) => Number.isFinite(v) && v > 0);
  } else {
    const since = new Date(now - sprintWindow * 7 * 24 * 60 * 60 * 1000).toISOString();
    items = await db.collection('workitems').find({
      bundleId: String(bundleId),
      status: WorkItemStatus.DONE,
      updatedAt: { $gte: since }
    }).toArray();
    const buckets = new Map<string, number>();
    items.forEach((item: any) => {
      const updated = item.updatedAt ? new Date(item.updatedAt) : null;
      if (!updated || Number.isNaN(updated.getTime())) return;
      const key = updated.toISOString().slice(0, 10);
      const points = typeof item.storyPoints === 'number' ? item.storyPoints : 0;
      buckets.set(key, (buckets.get(key) || 0) + points);
    });
    weeklySamples = Array.from(buckets.values()).map((v) => Number(v.toFixed(2))).filter((v) => v > 0);
  }

  let pointsTotal = 0;
  let hoursTotal = 0;

  items.forEach((item: any) => {
    if (typeof item.storyPoints === 'number') pointsTotal += item.storyPoints;
    if (typeof item.timeEstimate === 'number') hoursTotal += item.timeEstimate;
  });

  sampleSize = items.length;

  const avgVelocityPoints = divisor > 0 ? Number((pointsTotal / divisor).toFixed(2)) : 0;
  const avgVelocityHours = divisor > 0 ? Number((hoursTotal / divisor).toFixed(2)) : 0;

  return { avgVelocityPoints, avgVelocityHours, sampleSize, sprintLengthDays, weeklySamples };
};

export const forecastMilestoneCompletion = async (
  milestoneRollup: any,
  velocity: { avgVelocityPoints: number; sampleSize: number; sprintLengthDays?: number },
  policyOverride?: DeliveryPolicy
) => {
  const policy = policyOverride || await getDeliveryPolicy();
  const remainingPoints = milestoneRollup?.capacity?.remainingPoints ?? 0;
  const endDateRaw = milestoneRollup?.schedule?.endDate;
  if (!endDateRaw || remainingPoints <= 0) return null;
  const minSample = policy.forecasting.minSampleSize ?? 3;
  if (!velocity || velocity.sampleSize < minSample || velocity.avgVelocityPoints <= 0) return null;

  const sprintLengthDays = velocity.sprintLengthDays || DEFAULT_SPRINT_LENGTH_DAYS;
  const sprintsRemaining = Number((remainingPoints / velocity.avgVelocityPoints).toFixed(2));
  const now = Date.now();
  const estimatedCompletionDate = new Date(now + sprintsRemaining * sprintLengthDays * 24 * 60 * 60 * 1000);
  const endDate = new Date(endDateRaw);
  const varianceMs = estimatedCompletionDate.getTime() - endDate.getTime();
  const varianceDays = Math.ceil(varianceMs / (24 * 60 * 60 * 1000));

  const scheduleRemainingDays = Math.max(1, Math.ceil((endDate.getTime() - now) / (24 * 60 * 60 * 1000)));
  const overrunRatio = varianceDays > 0 ? varianceDays / scheduleRemainingDays : 0;

  let band: 'on-track' | 'at-risk' | 'off-track' = 'on-track';
  if (varianceDays <= 0) {
    band = 'on-track';
  } else if (overrunRatio <= policy.forecasting.atRiskPct) {
    band = 'at-risk';
  } else if (overrunRatio >= policy.forecasting.offTrackPct) {
    band = 'off-track';
  } else {
    band = 'at-risk';
  }

  return {
    estimatedCompletionDate: estimatedCompletionDate.toISOString(),
    sprintsRemaining,
    varianceDays,
    band
  };
};
