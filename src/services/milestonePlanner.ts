import type { DeliveryPlanInput, DeliveryPlanMilestoneDraft, NormalizedPlanInput } from '../types';

const parseDate = (value?: string) => (value ? new Date(value) : null);

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const diffDays = (start: Date, end: Date) => Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

export const deriveMilestoneDuration = (overallStart: Date, goLive: Date, milestoneCount: number) => {
  const totalDays = diffDays(overallStart, goLive);
  const days = milestoneCount > 0 ? totalDays / milestoneCount : null;
  const weeks = days != null ? days / 7 : null;
  return { days, weeks };
};

export const normalizePlanInput = (input: DeliveryPlanInput): NormalizedPlanInput => {
  const warnings: string[] = [];
  const assumptions: string[] = [];
  const plannedStart = parseDate(input.plannedStartDate) || null;
  const devStart = parseDate(input.devStartDate);
  const uatStart = parseDate(input.uatStartDate);
  const goLive = parseDate(input.goLiveDate);
  const integrationStart = parseDate(input.integrationStartDate) || null;
  const stabilizationEnd = parseDate(input.stabilizationEndDate) || null;

  if (!devStart || !uatStart || !goLive) {
    throw new Error('Dev start, UAT start, and Go-Live dates are required.');
  }

  const overallStart = plannedStart || devStart;
  const overallEnd = stabilizationEnd || goLive;

  if (overallStart.getTime() <= devStart.getTime()) {
    // ok
  } else {
    warnings.push('Planned start is before dev start; using planned start as overall start.');
  }

  if (!(overallStart.getTime() <= devStart.getTime() && devStart.getTime() <= uatStart.getTime() && uatStart.getTime() <= goLive.getTime())) {
    throw new Error('Date order must satisfy planned/dev start <= UAT start <= Go-Live.');
  }

  if (integrationStart && (integrationStart.getTime() < devStart.getTime() || integrationStart.getTime() > uatStart.getTime())) {
    warnings.push('Integration start is outside the Dev → UAT window.');
  }
  if (!integrationStart) {
    assumptions.push('Integration start not provided; inferred within Dev → UAT window.');
  }

  const milestoneCount = Math.max(1, Number(input.milestoneCount || 1));
  const sprintDurationWeeks = Math.max(1, Number(input.sprintDurationWeeks || 1));
  const milestoneDurationWeeks = input.milestoneDurationWeeks ? Number(input.milestoneDurationWeeks) : undefined;
  const derived = deriveMilestoneDuration(overallStart, goLive, milestoneCount);

  return {
    plannedStart,
    devStart,
    integrationStart,
    uatStart,
    goLive,
    stabilizationEnd,
    overallStart,
    overallEnd,
    milestoneCount,
    sprintDurationWeeks,
    milestoneDurationWeeks,
    derivedMilestoneDurationDays: derived.days,
    derivedMilestoneDurationWeeks: derived.weeks,
    warnings,
    assumptions
  };
};

export const generateMilestones = (
  input: DeliveryPlanInput,
  normalized: NormalizedPlanInput
): DeliveryPlanMilestoneDraft[] => {
  const { overallStart, goLive, uatStart, milestoneCount, milestoneDurationWeeks, warnings } = normalized;
  const milestones: DeliveryPlanMilestoneDraft[] = [];

  if (input.milestoneDurationStrategy === 'FIXED_WEEKS' && milestoneDurationWeeks) {
    for (let i = 1; i <= milestoneCount; i += 1) {
      const start = addDays(overallStart, (i - 1) * milestoneDurationWeeks * 7);
      const end = addDays(start, milestoneDurationWeeks * 7);
      if (end.getTime() > goLive.getTime()) {
        warnings.push('Fixed milestone duration exceeds the delivery window. Adjust dates or milestone count.');
      }
      milestones.push({
        index: i,
        name: `Milestone ${i}`,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        themes: []
      });
    }
    return milestones;
  }

  if (milestoneCount === 1) {
    milestones.push({
      index: 1,
      name: 'Milestone 1',
      startDate: overallStart.toISOString(),
      endDate: goLive.toISOString(),
      themes: []
    });
    return milestones;
  }

  const preUatDurationMs = uatStart.getTime() - overallStart.getTime();
  if (preUatDurationMs <= 0) {
    warnings.push('UAT start is not after planned start; distributing milestones evenly to Go-Live.');
    const totalMs = goLive.getTime() - overallStart.getTime();
    const slice = totalMs / milestoneCount;
    for (let i = 0; i < milestoneCount; i += 1) {
      const start = new Date(overallStart.getTime() + i * slice);
      const end = new Date(overallStart.getTime() + (i + 1) * slice);
      milestones.push({
        index: i + 1,
        name: `Milestone ${i + 1}`,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        themes: []
      });
    }
    return milestones;
  }

  const slice = preUatDurationMs / (milestoneCount - 1);
  for (let i = 0; i < milestoneCount - 1; i += 1) {
    const start = new Date(overallStart.getTime() + i * slice);
    const end = new Date(overallStart.getTime() + (i + 1) * slice);
    milestones.push({
      index: i + 1,
      name: `Milestone ${i + 1}`,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      themes: []
    });
  }
  milestones.push({
    index: milestoneCount,
    name: `Milestone ${milestoneCount}`,
    startDate: uatStart.toISOString(),
    endDate: goLive.toISOString(),
    themes: []
  });

  return milestones;
};

export const milestoneDateHelpers = { addDays, diffDays };
