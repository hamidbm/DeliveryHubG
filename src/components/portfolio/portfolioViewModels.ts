import type { PortfolioPlanDetail, PortfolioOverview, PortfolioDependencyEdge, PortfolioMilestoneInsight } from '../../types';

export type PortfolioTimelineRow = {
  planId: string;
  planName: string;
  milestones: Array<{
    id: string;
    name: string;
    startDate?: string;
    endDate?: string;
    riskLevel?: PortfolioMilestoneInsight['riskLevel'];
    utilizationPercent?: number | null;
  }>;
};

export type PortfolioHealthRow = {
  planId: string;
  planName: string;
  milestoneCount: number;
  highRisk: number;
  overloaded: number;
  avgUtilization: number | null;
};

export type PortfolioDependencyGraph = {
  nodes: Array<{
    id: string;
    label: string;
    planName: string;
    riskLevel?: PortfolioMilestoneInsight['riskLevel'];
    inbound: number;
    outbound: number;
  }>;
  edges: PortfolioDependencyEdge[];
};

export const buildPortfolioOverview = (plans: PortfolioPlanDetail[]): PortfolioOverview => {
  let totalMilestones = 0;
  let highRiskMilestones = 0;
  let overloadedMilestones = 0;
  let utilizationSum = 0;
  let utilizationCount = 0;

  plans.forEach((plan) => {
    totalMilestones += plan.milestoneCount;
    plan.milestones.forEach((ms) => {
      if (ms.riskLevel === 'HIGH') highRiskMilestones += 1;
      if (ms.utilizationState === 'OVERLOADED') overloadedMilestones += 1;
      if (typeof ms.utilizationPercent === 'number') {
        utilizationSum += ms.utilizationPercent;
        utilizationCount += 1;
      }
    });
  });

  return {
    totalPlans: plans.length,
    totalMilestones,
    highRiskMilestones,
    overloadedMilestones,
    avgUtilization: utilizationCount ? utilizationSum / utilizationCount : null,
    plansWithSimulations: 0
  };
};

export const buildPortfolioTimelineRows = (plans: PortfolioPlanDetail[]): PortfolioTimelineRow[] => {
  return plans.map((plan) => ({
    planId: plan.id,
    planName: plan.name,
    milestones: plan.milestones.map((ms) => ({
      id: ms.id,
      name: ms.name,
      startDate: ms.startDate,
      endDate: ms.endDate,
      riskLevel: ms.riskLevel,
      utilizationPercent: ms.utilizationPercent ?? null
    }))
  }));
};

export const computePortfolioHealthMetrics = (plans: PortfolioPlanDetail[]): PortfolioHealthRow[] => {
  return plans.map((plan) => {
    let highRisk = 0;
    let overloaded = 0;
    let utilizationSum = 0;
    let utilizationCount = 0;
    plan.milestones.forEach((ms) => {
      if (ms.riskLevel === 'HIGH') highRisk += 1;
      if (ms.utilizationState === 'OVERLOADED') overloaded += 1;
      if (typeof ms.utilizationPercent === 'number') {
        utilizationSum += ms.utilizationPercent;
        utilizationCount += 1;
      }
    });
    return {
      planId: plan.id,
      planName: plan.name,
      milestoneCount: plan.milestoneCount,
      highRisk,
      overloaded,
      avgUtilization: utilizationCount ? utilizationSum / utilizationCount : null
    };
  });
};

export const buildPortfolioDependencyGraph = (
  plans: PortfolioPlanDetail[],
  edges: PortfolioDependencyEdge[]
): PortfolioDependencyGraph => {
  const milestoneMap = new Map<string, { planName: string; label: string; riskLevel?: PortfolioMilestoneInsight['riskLevel'] }>();
  plans.forEach((plan) => {
    plan.milestones.forEach((ms) => {
      milestoneMap.set(ms.id, {
        planName: plan.name,
        label: ms.name,
        riskLevel: ms.riskLevel
      });
    });
  });

  const pressure: Record<string, { inbound: number; outbound: number }> = {};
  edges.forEach((edge) => {
    if (!pressure[edge.fromMilestoneId]) pressure[edge.fromMilestoneId] = { inbound: 0, outbound: 0 };
    if (!pressure[edge.toMilestoneId]) pressure[edge.toMilestoneId] = { inbound: 0, outbound: 0 };
    pressure[edge.fromMilestoneId].outbound += edge.count;
    pressure[edge.toMilestoneId].inbound += edge.count;
  });

  const nodes = Array.from(milestoneMap.entries()).map(([id, meta]) => ({
    id,
    label: meta.label,
    planName: meta.planName,
    riskLevel: meta.riskLevel,
    inbound: pressure[id]?.inbound || 0,
    outbound: pressure[id]?.outbound || 0
  }));

  return { nodes, edges };
};
