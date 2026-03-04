import { getMongoClientPromise } from '../lib/mongodb';
import { getDeliveryPolicy, DeliveryPolicy } from './policy';
import { WorkItemStatus } from '../types';

const DEFAULT_SPRINT_LENGTH_DAYS = 14;

const getDb = async () => {
  const client = await getMongoClientPromise();
  return client.db();
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

  if (sprints.length) {
    const sprintIds = sprints.map((s: any) => String(s._id || s.id || '')).filter(Boolean);
    divisor = sprints.length;
    items = await db.collection('workitems').find({
      bundleId: String(bundleId),
      sprintId: { $in: sprintIds },
      status: WorkItemStatus.DONE
    }).toArray();
  } else {
    const since = new Date(now - sprintWindow * 7 * 24 * 60 * 60 * 1000).toISOString();
    items = await db.collection('workitems').find({
      bundleId: String(bundleId),
      status: WorkItemStatus.DONE,
      updatedAt: { $gte: since }
    }).toArray();
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

  return { avgVelocityPoints, avgVelocityHours, sampleSize, sprintLengthDays: DEFAULT_SPRINT_LENGTH_DAYS };
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
