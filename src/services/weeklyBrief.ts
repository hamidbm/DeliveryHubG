import { computeMilestoneRollup, computeMilestoneRollups } from './rollupAnalytics';
import { computeBundleCapacityPlans } from './capacityPlanning';
import { computeMilestoneBaselineDelta } from './baselineDelta';
import { createVisibilityContext } from './visibility';
import { listDecisionSummariesForRange } from '../server/db/repositories/decisionsRepo';
import { findBundleByAnyId, listBundles } from '../server/db/repositories/bundlesRepo';
import { getMilestoneByRef, listMilestones } from '../server/db/repositories/milestonesRepo';
import { getCommitmentDriftSnapshotByMilestoneId, listCommitmentDriftSnapshotsByMilestoneIds } from '../server/db/repositories/commitmentRepo';
import { listBlockedWorkItemsByMilestoneRefs } from '../server/db/repositories/workItemsRepo';
import { enqueueNotificationDigestItems, listDigestOptInUserPrefsDocs, listNotificationDigestQueueItems } from '../server/db/repositories/notificationPlatformRepo';
import { getWeeklyBriefRecord, insertWeeklyBriefRecordIfMissing, upsertWeeklyBriefRecord } from '../server/db/repositories/weeklyBriefsRepo';

type WeeklyBrief = {
  scopeType: 'PROGRAM' | 'BUNDLE' | 'MILESTONE';
  scopeId?: string;
  weekKey: string;
  generatedAt: string;
  generatedBy: string;
  summary: {
    headline: string;
    band: 'GREEN' | 'YELLOW' | 'RED';
    bullets: string[];
  };
  sections: {
    forecast?: { p80?: string; hitProbability?: number; delta?: string };
    scope?: { netDeltaPoints?: number; added?: number; removed?: number; estimateDelta?: number };
    capacity?: { overcommitMax?: number; drivers?: string[] };
    blockers?: { top?: Array<{ key: string; title: string; owner?: string }> };
    actions?: { top?: Array<{ text: string; owner?: string; link?: string }> };
    decisions?: { top?: Array<{ title: string; outcome: string; severity: string }> };
  };
  links: Array<{ label: string; href: string }>;
};

const formatDate = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString();
};

const getWeekKey = (date = new Date()) => {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  const year = target.getUTCFullYear();
  return `${year}-W${String(week).padStart(2, '0')}`;
};

const weekKeyToRange = (weekKey: string) => {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) {
    const now = new Date();
    return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now };
  }
  const year = Number(match[1]);
  const week = Number(match[2]);
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const day = simple.getUTCDay();
  const start = new Date(simple);
  if (day <= 4) {
    start.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    start.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
};

const fetchDecisionsForScope = async (scopeType: WeeklyBrief['scopeType'], scopeId: string | undefined, weekKey: string) => {
  const { start, end } = weekKeyToRange(weekKey);
  const items = await listDecisionSummariesForRange({
    scopeType,
    scopeId,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    limit: 5
  });
  return items.map((d: any) => ({
    title: d.title,
    outcome: d.outcome,
    severity: d.severity
  }));
};

const bandFromSignals = (inputs: { hasMajor?: boolean; hasMinor?: boolean; hitProbability?: number; p80PastEnd?: boolean }) => {
  if (inputs.hasMajor || (inputs.p80PastEnd && (inputs.hitProbability ?? 1) < 0.5)) return 'RED';
  if (inputs.hasMinor || (inputs.hitProbability !== undefined && inputs.hitProbability < 0.7)) return 'YELLOW';
  return 'GREEN';
};

const buildScopeSummary = (delta: any) => {
  if (!delta) return undefined;
  return {
    netDeltaPoints: delta.netScopeDeltaPoints,
    added: delta.added?.count,
    removed: delta.removed?.count,
    estimateDelta: delta.estimateChanges?.pointsDelta
  };
};

const buildForecastSummary = (rollup: any, deltaLabel?: string) => {
  const mc = rollup?.forecast?.monteCarlo;
  if (!mc) return undefined;
  return {
    p80: mc.p80,
    hitProbability: mc.hitProbability,
    delta: deltaLabel
  };
};

const loadMilestoneSignals = async (milestoneId: string) => {
  return await getCommitmentDriftSnapshotByMilestoneId(milestoneId);
};

const fetchTopBlockers = async (milestoneId: string) => {
  const items = await listBlockedWorkItemsByMilestoneRefs([milestoneId], 3);
  return items.map((item: any) => ({
    key: item.key || String(item._id || item.id || ''),
    title: item.title || 'Blocked item',
    owner: item.assignedTo || item.ownerEmail
  }));
};

export const generateMilestoneBrief = async (
  milestoneId: string,
  weekKey: string,
  userContext?: { userId?: string; visibility?: ReturnType<typeof createVisibilityContext> }
): Promise<WeeklyBrief | null> => {
  const milestone = await getMilestoneByRef(milestoneId);
  if (!milestone) return null;

  const rollup = await computeMilestoneRollup(String(milestone._id || milestone.id || milestone.name || milestoneId));
  const delta = await computeMilestoneBaselineDelta(String(milestone._id || milestone.id || milestone.name || milestoneId), {
    visibilityContext: userContext?.visibility,
    includeHidden: !userContext?.visibility
  });
  const driftSnapshot = await loadMilestoneSignals(String(milestone._id || milestone.id || milestone.name || milestoneId));
  const blockers = await fetchTopBlockers(String(milestone._id || milestone.id || milestone.name || milestoneId));

  const mc = rollup?.forecast?.monteCarlo;
  const endDate = milestone.endDate ? new Date(milestone.endDate) : null;
  const p80 = mc?.p80 ? new Date(mc.p80) : null;
  const p80PastEnd = !!(endDate && p80 && p80.getTime() > endDate.getTime());
  const hitProbability = mc?.hitProbability;
  const hasMajor = driftSnapshot?.driftBand === 'MAJOR';
  const hasMinor = driftSnapshot?.driftBand === 'MINOR';

  const band = bandFromSignals({ hasMajor, hasMinor, hitProbability, p80PastEnd });
  const scopeDeltaPoints = delta?.netScopeDeltaPoints ?? 0;
  const headlineParts = [];
  if (hasMajor) headlineParts.push(`${milestone.name} drifting`);
  if (!hasMajor && scopeDeltaPoints > 0) headlineParts.push(`${milestone.name} scope +${scopeDeltaPoints} pts`);
  if (!headlineParts.length) headlineParts.push(`${milestone.name} on track`);
  const headline = headlineParts.join('; ');

  const bullets: string[] = [];
  if (mc?.p80) {
    bullets.push(`P80 ${formatDate(mc.p80)}; hit probability ${Math.round((mc.hitProbability || 0) * 100)}%${scopeDeltaPoints ? ` (scope ${scopeDeltaPoints > 0 ? '+' : ''}${scopeDeltaPoints} pts)` : ''}`);
  }
  if (blockers.length) {
    bullets.push(`Top blocker: ${blockers[0].key} (${blockers[0].title})`);
  }
  if (delta?.estimateChanges?.pointsDelta) {
    bullets.push(`Estimates changed by ${delta.estimateChanges.pointsDelta > 0 ? '+' : ''}${delta.estimateChanges.pointsDelta} pts`);
  }
  const decisions = await fetchDecisionsForScope('MILESTONE', String(milestone._id || milestone.id || milestone.name || milestoneId), weekKey);
  if (decisions.length) {
    bullets.push(`Decisions logged: ${decisions.length}`);
  }

  const actions: WeeklyBrief['sections']['actions'] = {
    top: []
  };
  if (scopeDeltaPoints > 0) {
    actions.top?.push({
      text: `Review scope increase (+${scopeDeltaPoints} pts)`,
      owner: milestone.ownerEmail || milestone.ownerUserId,
      link: `/work-items?view=milestone-plan&milestoneId=${encodeURIComponent(String(milestone._id || milestone.id || milestone.name))}`
    });
  }
  if (blockers.length) {
    actions.top?.push({
      text: `Unblock ${blockers[0].key}`,
      owner: blockers[0].owner
    });
  }

  return {
    scopeType: 'MILESTONE',
    scopeId: String(milestone._id || milestone.id || milestone.name || milestoneId),
    weekKey,
    generatedAt: new Date().toISOString(),
    generatedBy: userContext?.userId || 'system',
    summary: {
      headline,
      band,
      bullets
    },
    sections: {
      forecast: buildForecastSummary(rollup, delta ? `Scope ${scopeDeltaPoints > 0 ? '+' : ''}${scopeDeltaPoints} pts` : undefined),
      scope: buildScopeSummary(delta),
      capacity: rollup?.capacity ? {
        overcommitMax: typeof rollup.capacity.targetCapacity === 'number'
          ? Math.max(0, (rollup.capacity.committedPoints || 0) - rollup.capacity.targetCapacity)
          : undefined
      } : undefined,
      blockers: { top: blockers },
      actions,
      decisions: { top: decisions }
    },
    links: [
      { label: 'Milestone Plan', href: `/work-items?view=milestone-plan&milestoneId=${encodeURIComponent(String(milestone._id || milestone.id || milestone.name))}` },
      { label: 'Roadmap', href: '/?tab=work-items&view=roadmap' }
    ]
  };
};

export const generateBundleBrief = async (
  bundleId: string,
  weekKey: string,
  userContext?: { userId?: string; visibility?: ReturnType<typeof createVisibilityContext> }
): Promise<WeeklyBrief | null> => {
  const bundle = await findBundleByAnyId(bundleId);
  const milestones = await listMilestones({ bundleId: String(bundleId), applicationId: null, status: null });
  const milestoneIds = milestones.map((m: any) => String(m._id || m.id || m.name)).filter(Boolean);
  if (!milestoneIds.length) return null;

  const rollups = await computeMilestoneRollups(milestoneIds);
  const driftSnapshots = await listCommitmentDriftSnapshotsByMilestoneIds(milestoneIds);
  const major = driftSnapshots.filter((s: any) => s.driftBand === 'MAJOR');
  const minor = driftSnapshots.filter((s: any) => s.driftBand === 'MINOR');

  let netScopeDelta = 0;
  for (const milestoneId of milestoneIds.slice(0, 10)) {
    const delta = await computeMilestoneBaselineDelta(milestoneId, {
      visibilityContext: userContext?.visibility,
      includeHidden: !userContext?.visibility
    });
    if (delta) netScopeDelta += delta.netScopeDeltaPoints || 0;
  }

  const band = bandFromSignals({ hasMajor: major.length > 0, hasMinor: minor.length > 0 });
  const headline = major.length
    ? `${major.length} milestones drifting in ${bundle?.name || bundleId}`
    : netScopeDelta > 0
      ? `${bundle?.name || bundleId} scope +${Math.round(netScopeDelta)} pts`
      : `${bundle?.name || bundleId} steady execution`;

  const bullets = [
    `${major.length} major drift / ${minor.length} minor drift milestones`,
    `Net scope change ${netScopeDelta > 0 ? '+' : ''}${Math.round(netScopeDelta)} pts (top 10 milestones)`
  ];
  const decisions = await fetchDecisionsForScope('BUNDLE', String(bundleId), weekKey);
  if (decisions.length) {
    bullets.push(`Decisions logged: ${decisions.length}`);
  }

  const capacity = await computeBundleCapacityPlans([String(bundleId)], 8);
  const plan = capacity.bundlePlans?.[0];
  const overcommitMax = plan?.summary?.maxOverBy;

  return {
    scopeType: 'BUNDLE',
    scopeId: String(bundleId),
    weekKey,
    generatedAt: new Date().toISOString(),
    generatedBy: userContext?.userId || 'system',
    summary: {
      headline,
      band,
      bullets
    },
    sections: {
      scope: { netDeltaPoints: Number(netScopeDelta.toFixed(2)) },
      capacity: { overcommitMax },
      decisions: { top: decisions }
    },
    links: [
      { label: 'Bundle Profile', href: `/applications/bundles/${encodeURIComponent(String(bundleId))}` },
      { label: 'Program', href: `/program?bundleIds=${encodeURIComponent(String(bundleId))}` }
    ]
  };
};

export const generateProgramBrief = async (
  weekKey: string,
  userContext?: { userId?: string; visibility?: ReturnType<typeof createVisibilityContext> }
): Promise<WeeklyBrief> => {
  let bundles = await listBundles(false);
  let milestones = await listMilestones({ bundleId: null, applicationId: null, status: null });
  if (userContext?.visibility) {
    const filtered = [];
    for (const bundle of bundles) {
      const id = String(bundle._id || bundle.id || bundle.name || '');
      if (id && await userContext.visibility.canViewBundle(id)) {
        filtered.push(bundle);
      }
    }
    bundles = filtered;
    const bundleIdsSet = new Set(filtered.map((b: any) => String(b._id || b.id || b.name || '')));
    milestones = milestones.filter((m: any) => bundleIdsSet.has(String(m.bundleId || '')));
  }
  const bundleIds = bundles.map((b: any) => String(b._id || b.id || b.name)).filter(Boolean);
  const milestoneIds = milestones.map((m: any) => String(m._id || m.id || m.name)).filter(Boolean);
  const rollups = await computeMilestoneRollups(milestoneIds);
  const driftSnapshots = await listCommitmentDriftSnapshotsByMilestoneIds(milestoneIds);
  const major = driftSnapshots.filter((s: any) => s.driftBand === 'MAJOR');
  const minor = driftSnapshots.filter((s: any) => s.driftBand === 'MINOR');

  const band = bandFromSignals({ hasMajor: major.length > 0, hasMinor: minor.length > 0 });
  const headline = major.length
    ? `${major.length} milestones drifting across program`
    : 'Program delivery steady';

  const bullets = [
    `${major.length} major drift / ${minor.length} minor drift milestones`,
    `${rollups.length} active milestones tracked`,
    `${bundleIds.length} bundles in scope`
  ];
  const decisions = await fetchDecisionsForScope('PROGRAM', 'program', weekKey);
  if (decisions.length) {
    bullets.push(`Decisions logged: ${decisions.length}`);
  }

  return {
    scopeType: 'PROGRAM',
    scopeId: 'program',
    weekKey,
    generatedAt: new Date().toISOString(),
    generatedBy: userContext?.userId || 'system',
    summary: {
      headline,
      band,
      bullets
    },
    sections: { decisions: { top: decisions } },
    links: [
      { label: 'Program', href: '/program' },
      { label: 'Roadmap', href: '/?tab=work-items&view=roadmap' }
    ]
  };
};

export const upsertWeeklyBrief = async (brief: WeeklyBrief, force = false) => {
  if (force) {
    return await upsertWeeklyBriefRecord(brief as unknown as Record<string, unknown>) as unknown as WeeklyBrief;
  }
  return await insertWeeklyBriefRecordIfMissing(brief as unknown as Record<string, unknown>) as unknown as WeeklyBrief;
};

export const fetchWeeklyBrief = async (scopeType: WeeklyBrief['scopeType'], scopeId: string | undefined, weekKey: string) => {
  const found = await getWeeklyBriefRecord(scopeType, scopeId, weekKey);
  return (found as unknown as WeeklyBrief) || null;
};

export const resolveWeekKey = (input?: string) => input || getWeekKey();

export const queueWeeklyBriefDigest = async (brief: WeeklyBrief) => {
  const prefs = await listDigestOptInUserPrefsDocs();
  const createdAt = new Date().toISOString();
  const userIds = prefs.map((pref: any) => String(pref.userId || '')).filter(Boolean);
  const existing = userIds.length
    ? await listNotificationDigestQueueItems({
        userId: { $in: userIds },
        type: 'weekly.brief.available',
        weekKey: brief.weekKey,
        scopeType: brief.scopeType,
        scopeId: brief.scopeId || null
      })
    : [];
  const existingUserIds = new Set(existing.map((item: any) => String(item.userId || '')).filter(Boolean));
  const items: Array<Record<string, unknown>> = [];
  for (const pref of prefs) {
    const userId = String(pref.userId || '');
    if (!userId || existingUserIds.has(userId)) continue;
    items.push({
      userId,
      type: 'weekly.brief.available',
      weekKey: brief.weekKey,
      scopeType: brief.scopeType,
      scopeId: brief.scopeId || null,
      title: 'Weekly Executive Brief',
      body: `${brief.summary.headline}`,
      link: brief.links?.[0]?.href,
      createdAt
    });
  }
  await enqueueNotificationDigestItems(items);
};
