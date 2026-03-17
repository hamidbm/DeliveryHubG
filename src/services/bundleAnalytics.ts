import { WorkItemStatus } from '../types';
import { listBundleProfiles } from '../server/db/repositories/bundlesRepo';
import { listBundleRiskDependencyWorkItems } from '../server/db/repositories/workItemsRepo';

export const computeBundleHealth = async (bundleIds: string[]) => {
  try {
    const bundleIdList = (bundleIds || []).map(String).filter(Boolean);
    const profiles = await listBundleProfiles(bundleIdList);
    const profileMap = new Map(profiles.map((p: any) => [String(p.bundleId), p]));

    const workItems = await listBundleRiskDependencyWorkItems(bundleIdList);

    const itemsByBundle = new Map<string, any[]>();
    workItems.forEach((item: any) => {
      const bundleId = String(item.bundleId || item?.context?.bundleId || '');
      if (!bundleId) return;
      if (!itemsByBundle.has(bundleId)) itemsByBundle.set(bundleId, []);
      itemsByBundle.get(bundleId)!.push(item);
    });

    const computeSeverity = (risk: any) => {
      const p = Number(risk?.probability || 0);
      const i = Number(risk?.impact || 0);
      const score = p * i;
      if (!p || !i) return undefined;
      if (score <= 4) return 'low';
      if (score <= 9) return 'medium';
      if (score <= 16) return 'high';
      return 'critical';
    };

    const today = new Date();
    return bundleIdList.map((bundleId) => {
      const profile = profileMap.get(String(bundleId));
      const items = itemsByBundle.get(String(bundleId)) || [];
      const risks = items.filter((i) => i.type === 'RISK');
      const deps = items.filter((i) => i.type === 'DEPENDENCY');

      const isOpen = (item: any) => String(item.status || '').toUpperCase() !== String(WorkItemStatus.DONE);
      const isOverdue = (item: any) => item.dueAt && new Date(item.dueAt) < today && isOpen(item);

      const openRisksBySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
      let overdueCount = 0;
      let overdueBlockingDeps = 0;
      let openRiskPenalty = 0;
      let overduePenalty = 0;
      let blockingDependenciesCount = 0;

      risks.forEach((r) => {
        if (!isOpen(r)) return;
        const severity = r?.risk?.severity || computeSeverity(r?.risk);
        if (severity && openRisksBySeverity[severity as keyof typeof openRisksBySeverity] !== undefined) {
          openRisksBySeverity[severity as keyof typeof openRisksBySeverity] += 1;
        }
        if (severity === 'low') openRiskPenalty += 2;
        else if (severity === 'medium') openRiskPenalty += 5;
        else if (severity === 'high') openRiskPenalty += 10;
        else if (severity === 'critical') openRiskPenalty += 20;

        if (isOverdue(r)) {
          overdueCount += 1;
          overduePenalty += 5;
        }
      });

      deps.forEach((d) => {
        const blocking = d?.dependency?.blocking !== false;
        if (blocking && isOpen(d)) blockingDependenciesCount += 1;
        if (isOverdue(d)) {
          overdueCount += 1;
          overduePenalty += blocking ? 10 : 3;
          if (blocking && isOpen(d)) overdueBlockingDeps += 1;
        }
      });

      openRiskPenalty = Math.min(openRiskPenalty, 40);
      overduePenalty = Math.min(overduePenalty, 30);

      const milestones = profile?.schedule?.milestones || [];
      const current = milestones.find((m: any) => m.status === 'in_progress') || milestones.find((m: any) => m.status !== 'done') || null;
      const blockedMilestone = milestones.some((m: any) => m.status === 'blocked');

      let scheduleSlipDays = 0;
      let schedulePenalty = 0;
      if (current?.plannedEnd && current?.status !== 'done') {
        const plannedEnd = new Date(current.plannedEnd);
        const slip = Math.max(0, Math.floor((today.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24)));
        scheduleSlipDays = slip;
        schedulePenalty = Math.min(30, slip * 2);
      }

      const blockedPenalty = blockedMilestone ? 20 : 0;
      const healthScore = Math.max(0, Math.min(100, 100 - schedulePenalty - openRiskPenalty - overduePenalty - blockedPenalty));
      const healthBand = healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'watch' : 'at_risk';

      const hardTrigger =
        openRisksBySeverity.critical > 0 ||
        overdueBlockingDeps > 0 ||
        blockedMilestone;

      const thresholdTrigger =
        openRisksBySeverity.high >= 2 ||
        (openRisksBySeverity.medium + openRisksBySeverity.high + openRisksBySeverity.critical >= 1 && overdueCount > 0) ||
        (scheduleSlipDays > 0 && current && current.status !== 'done');

      let computedStatus: 'on_track' | 'at_risk' | 'blocked' | 'unknown' = 'on_track';
      if (blockedMilestone) computedStatus = 'blocked';
      else if (hardTrigger || thresholdTrigger || healthScore < 60) computedStatus = 'at_risk';

      return {
        bundleId,
        healthScore,
        healthBand,
        computedStatus,
        openRisksBySeverity,
        overdueCount,
        blockingDependenciesCount,
        scheduleSlipDays
      };
    });
  } catch {
    return [];
  }
};
