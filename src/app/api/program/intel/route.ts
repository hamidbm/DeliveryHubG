import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { computeMilestoneRollups, getDb } from '../../../../services/db';
import { evaluateMilestoneReadiness } from '../../../../services/milestoneGovernance';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../services/visibility';
import { getEffectivePolicyForMilestone } from '../../../../services/policy';

const parseList = (value: string | null) =>
  value ? value.split(',').map((v) => v.trim()).filter(Boolean) : [];

const buildMilestoneKey = (m: any) => String(m?._id || m?.id || m?.name || '');

const getMilestoneCandidates = (m: any) => {
  const set = new Set<string>();
  if (m?._id) set.add(String(m._id));
  if (m?.id) set.add(String(m.id));
  if (m?.name) set.add(String(m.name));
  return Array.from(set);
};

const bandForScore = (score: number) => (score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low');

export async function GET(request: Request) {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const visibility = createVisibilityContext(authUser);
  const { searchParams } = new URL(request.url);
  const includeLists = searchParams.get('includeLists') === 'true';
  const milestoneIds = parseList(searchParams.get('milestoneIds'));
  const bundleIdsRaw = parseList(searchParams.get('bundleIds'));
  const bundleIds = bundleIdsRaw.length
    ? (await Promise.all(bundleIdsRaw.map(async (id) => ({
      id,
      visible: await visibility.canViewBundle(id)
    })))).filter((b) => b.visible).map((b) => b.id)
    : [];
  const limit = Math.max(1, Number(searchParams.get('limit') || 10));

  const db = await getDb();

  let milestones: any[] = [];
  if (milestoneIds.length) {
    const objectIds = milestoneIds.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    milestones = await db.collection('milestones').find({
      $or: [
        { _id: { $in: objectIds } },
        { id: { $in: milestoneIds } },
        { name: { $in: milestoneIds } }
      ]
    }).toArray();
  } else if (bundleIds.length) {
    milestones = await db.collection('milestones').find({ bundleId: { $in: bundleIds } }).toArray();
  } else {
    milestones = await db.collection('milestones').find({}).toArray();
  }

  if (milestones.length) {
    const visible = await Promise.all(milestones.map(async (m) => ({
      milestone: m,
      visible: await visibility.canViewBundle(String(m.bundleId || ''))
    })));
    milestones = visible.filter((m) => m.visible).map((m) => m.milestone);
  }

  if (!milestones.length) {
    return NextResponse.json({
      summary: {
        bundles: 0,
        milestones: 0,
        workItems: 0,
        blockedDerived: 0,
        highCriticalRisks: 0,
        overdueOpen: 0
      },
      bundleRollups: [],
      listCounts: {
        topCrossBundleBlockers: 0,
        topAtRiskBundles: 0,
        topAtRiskMilestones: 0
      }
    });
  }

  const rollups = await computeMilestoneRollups(milestones.map(buildMilestoneKey));
  const rollupMap = new Map<string, any>();
  rollups.forEach((r: any) => rollupMap.set(String(r.milestoneId), r));

  const bundles = Array.from(new Set(milestones.map((m) => String(m.bundleId || '')).filter(Boolean)));
  const bundleDocs = bundles.length
    ? await db.collection('bundles').find({ _id: { $in: bundles.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } }).toArray()
    : [];
  const bundleNameMap = new Map<string, string>();
  bundleDocs.forEach((b: any) => bundleNameMap.set(String(b._id || b.id || ''), String(b.name || b.title || '')));

  const itemQuery: any = { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] };
  if (milestoneIds.length) {
    const objectIds = milestoneIds.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    itemQuery.$and = [
      { $or: [{ milestoneIds: { $in: milestoneIds } }, { milestoneIds: { $in: objectIds } }, { milestoneId: { $in: milestoneIds } }, { milestoneId: { $in: objectIds } }] }
    ];
  } else if (bundleIds.length) {
    itemQuery.bundleId = { $in: bundleIds };
  } else if (bundles.length) {
    itemQuery.bundleId = { $in: bundles };
  }

  let workItems = await db.collection('workitems')
    .find(itemQuery, { projection: { _id: 1, id: 1, key: 1, title: 1, status: 1, bundleId: 1, milestoneIds: 1, milestoneId: 1, links: 1, type: 1, risk: 1 } })
    .toArray();
  workItems = await visibility.filterVisibleWorkItems(workItems as any[]);

  const scopedItemIds = new Set<string>();
  workItems.forEach((item: any) => {
    const id = String(item._id || item.id || '');
    if (id) scopedItemIds.add(id);
    if (item.key) scopedItemIds.add(String(item.key));
  });

  let externalBlockers: any[] = [];
  if (scopedItemIds.size && (bundleIds.length || milestoneIds.length)) {
    const candidates = Array.from(scopedItemIds);
    const objectIds = candidates.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    const blockerQuery: any = {
      'links.type': 'BLOCKS',
      'links.targetId': { $in: [...candidates, ...objectIds] }
    };
    if (bundleIds.length) {
      blockerQuery.bundleId = { $nin: bundleIds };
    }
    externalBlockers = await db.collection('workitems')
      .find(blockerQuery, { projection: { _id: 1, id: 1, key: 1, title: 1, status: 1, bundleId: 1, milestoneIds: 1, milestoneId: 1, links: 1 } })
      .toArray();
    externalBlockers = await Promise.all(externalBlockers.map(async (item) => await visibility.redactWorkItem(item)));
  }

  const itemMap = new Map<string, any>();
  workItems.forEach((item: any) => {
    const id = String(item._id || item.id || '');
    if (id) itemMap.set(id, item);
    if (item.key) itemMap.set(String(item.key), item);
  });

  const bundleRollupsMap = new Map<string, any>();
  const milestoneCandidates = new Map<string, string[]>();
  milestones.forEach((m) => milestoneCandidates.set(buildMilestoneKey(m), getMilestoneCandidates(m)));

  for (const milestone of milestones) {
    const key = buildMilestoneKey(milestone);
    const candidates = milestoneCandidates.get(key) || [];
    const rollup = rollupMap.get(key) || candidates.map((c) => rollupMap.get(c)).find(Boolean);
    const policyRef = await getEffectivePolicyForMilestone(key);
    const readiness = rollup ? await evaluateMilestoneReadiness(rollup, policyRef.effective) : null;
    const bundleId = milestone.bundleId ? String(milestone.bundleId) : 'unassigned';
    if (!bundleRollupsMap.has(bundleId)) {
      bundleRollupsMap.set(bundleId, {
        bundleId,
        bundleName: bundleNameMap.get(bundleId),
        milestones: []
      });
    }
    bundleRollupsMap.get(bundleId).milestones.push({
      milestoneId: key,
      rollup,
      readiness,
      milestone
    });
  }

  const bundleRollups = Array.from(bundleRollupsMap.values()).map((bundle) => {
    const milestonesList = bundle.milestones || [];
    const count = milestonesList.length || 1;
    let confidenceSum = 0;
    let readinessSum = 0;
    let readinessCount = 0;
    let blockedDerived = 0;
    let highCriticalRisks = 0;
    let overdueOpen = 0;
    let isLateCount = 0;

    milestonesList.forEach((entry: any) => {
      const rollup = entry.rollup;
      if (rollup?.confidence?.score !== undefined) confidenceSum += rollup.confidence.score;
      if (entry.readiness?.score !== undefined) {
        readinessSum += entry.readiness.score;
        readinessCount += 1;
      }
      blockedDerived += rollup?.totals?.blockedDerived || 0;
      highCriticalRisks += (rollup?.risks?.openBySeverity?.high || 0) + (rollup?.risks?.openBySeverity?.critical || 0);
      overdueOpen += rollup?.totals?.overdueOpen || 0;
      const endDate = entry?.milestone?.endDate ? new Date(entry.milestone.endDate) : null;
      const p80 = rollup?.forecast?.monteCarlo?.p80 ? new Date(rollup.forecast.monteCarlo.p80) : null;
      const p80Late = endDate && p80 && !Number.isNaN(endDate.getTime()) && !Number.isNaN(p80.getTime()) && p80.getTime() > endDate.getTime();
      if (rollup?.schedule?.isLate || p80Late) isLateCount += 1;
    });

    const confidenceAvg = Number((confidenceSum / count).toFixed(2));
    const readinessAvg = Number(((readinessCount ? readinessSum / readinessCount : 0)).toFixed(2));
    const combined = (confidenceAvg + readinessAvg) / 2;
    const band = bandForScore(combined || 0);

    return {
      ...bundle,
      aggregated: {
        confidenceAvg,
        readinessAvg,
        blockedDerived,
        highCriticalRisks,
        overdueOpen,
        isLateCount
      },
      band
    };
  });

  const summary = {
    bundles: bundleRollups.length,
    milestones: milestones.length,
    workItems: workItems.length,
    blockedDerived: bundleRollups.reduce((sum, b) => sum + (b.aggregated?.blockedDerived || 0), 0),
    highCriticalRisks: bundleRollups.reduce((sum, b) => sum + (b.aggregated?.highCriticalRisks || 0), 0),
    overdueOpen: bundleRollups.reduce((sum, b) => sum + (b.aggregated?.overdueOpen || 0), 0)
  };

  const lists: any = {};
  const blockersSource = externalBlockers.length ? [...workItems, ...externalBlockers] : workItems;

  const buildCrossBundleBlockers = (includeSamples: boolean) => {
    const crossBundleBlockers = new Map<string, any>();
    blockersSource.forEach((blocker: any) => {
      const blockerBundleId = blocker.bundleId ? String(blocker.bundleId) : '';
      (blocker.links || []).filter((l: any) => String(l.type) === 'BLOCKS').forEach((link: any) => {
        const targetId = String(link.targetId || '');
        if (!targetId) return;
        const target = itemMap.get(targetId);
        if (!target || target.status === 'DONE') return;
        const targetBundleId = target.bundleId ? String(target.bundleId) : '';
        if (!blockerBundleId || !targetBundleId || targetBundleId === blockerBundleId) return;
        const blockerId = String(blocker._id || blocker.id || '');
        if (!crossBundleBlockers.has(blockerId)) {
          crossBundleBlockers.set(blockerId, {
            blockerId,
            blockerKey: blocker.key,
            blockerTitle: blocker.title,
            blockerStatus: blocker.status,
            blockerBundleId,
            blockerMilestoneId: blocker.milestoneId || (Array.isArray(blocker.milestoneIds) ? blocker.milestoneIds[0] : undefined),
            blockedCount: 0,
            sampleBlocked: includeSamples ? [] : undefined
          });
        }
        const entry = crossBundleBlockers.get(blockerId);
        entry.blockedCount += 1;
        if (includeSamples && entry.sampleBlocked.length < 5) {
          entry.sampleBlocked.push({
            id: String(target._id || target.id || ''),
            key: target.key,
            title: target.title,
            bundleId: targetBundleId,
            milestoneId: target.milestoneId || (Array.isArray(target.milestoneIds) ? target.milestoneIds[0] : undefined)
          });
        }
      });
    });

    return Array.from(crossBundleBlockers.values())
      .sort((a: any, b: any) => b.blockedCount - a.blockedCount)
      .slice(0, limit);
  };

  if (includeLists) {
    lists.topCrossBundleBlockers = buildCrossBundleBlockers(true);

    lists.topAtRiskBundles = [...bundleRollups]
      .sort((a, b) => {
        const scoreA = (b.aggregated?.blockedDerived || 0) + (b.aggregated?.highCriticalRisks || 0) + (b.aggregated?.overdueOpen || 0) - (b.aggregated?.confidenceAvg || 0) * 0.1;
        const scoreB = (a.aggregated?.blockedDerived || 0) + (a.aggregated?.highCriticalRisks || 0) + (a.aggregated?.overdueOpen || 0) - (a.aggregated?.confidenceAvg || 0) * 0.1;
        return scoreA - scoreB;
      })
      .slice(0, limit)
      .map((bundle) => ({
        bundleId: bundle.bundleId,
        bundleName: bundle.bundleName,
        blockedDerived: bundle.aggregated.blockedDerived,
        highCriticalRisks: bundle.aggregated.highCriticalRisks,
        overdueOpen: bundle.aggregated.overdueOpen,
        confidenceAvg: bundle.aggregated.confidenceAvg,
        readinessAvg: bundle.aggregated.readinessAvg,
        band: bundle.band
      }));

    const topAtRiskRaw = await Promise.all(milestones.map(async (milestone) => {
      const key = buildMilestoneKey(milestone);
      const candidates = milestoneCandidates.get(key) || [];
      const rollup = rollupMap.get(key) || candidates.map((c) => rollupMap.get(c)).find(Boolean);
      const policyRef = await getEffectivePolicyForMilestone(key);
      const readiness = rollup ? await evaluateMilestoneReadiness(rollup, policyRef.effective) : null;
      const highCriticalRisks = (rollup?.risks?.openBySeverity?.high || 0) + (rollup?.risks?.openBySeverity?.critical || 0);
      const p80 = rollup?.forecast?.monteCarlo?.p80 ? new Date(rollup.forecast.monteCarlo.p80) : null;
      const endDate = milestone?.endDate ? new Date(milestone.endDate) : null;
      const p80Slip = p80 && endDate && !Number.isNaN(p80.getTime()) && !Number.isNaN(endDate.getTime()) && p80.getTime() > endDate.getTime();
      return {
        milestoneId: key,
        milestoneName: milestone.name,
        blockedDerived: rollup?.totals?.blockedDerived || 0,
        highCriticalRisks,
        overdueOpen: rollup?.totals?.overdueOpen || 0,
        confidenceScore: rollup?.confidence?.score || 0,
        readinessBand: readiness?.band || 'low',
        isLate: rollup?.schedule?.isLate || false,
        slipDays: rollup?.schedule?.slipDays || 0,
        p80Slip
      };
    }));
    lists.topAtRiskMilestones = topAtRiskRaw.sort((a, b) => {
        const scoreA = b.blockedDerived + b.highCriticalRisks + b.overdueOpen + (b.p80Slip ? 5 : 0) - b.confidenceScore * 0.05;
        const scoreB = a.blockedDerived + a.highCriticalRisks + a.overdueOpen + (a.p80Slip ? 5 : 0) - a.confidenceScore * 0.05;
        return scoreA - scoreB;
      })
      .slice(0, limit);
  }

  const crossBundleCount = includeLists ? lists.topCrossBundleBlockers.length : buildCrossBundleBlockers(false).length;

  const listCounts = {
    topCrossBundleBlockers: crossBundleCount,
    topAtRiskBundles: includeLists ? lists.topAtRiskBundles.length : Math.min(limit, bundleRollups.length),
    topAtRiskMilestones: includeLists ? lists.topAtRiskMilestones.length : Math.min(limit, milestones.length)
  };

  return NextResponse.json({
    summary,
    bundleRollups,
    listCounts,
    ...(includeLists ? { lists } : {})
  });
}
