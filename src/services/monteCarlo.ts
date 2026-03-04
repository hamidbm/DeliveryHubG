type MonteCarloInput = {
  remainingPoints: number;
  weeklySamples: number[];
  iterations: number;
  pLevels: number[];
  endDate?: string;
  seed?: number;
  startDate?: Date;
  riskMultiplier?: number;
};

export type MonteCarloForecast = {
  enabled: boolean;
  iterations: number;
  remainingPointsUsed: number;
  p50: string;
  p80: string;
  p90: string;
  hitProbability: number;
  mean?: number;
  stdDev?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const resolveSeed = (seed?: number) => {
  if (Number.isFinite(seed)) return seed as number;
  if (process.env.NODE_ENV === 'test') return 1337;
  return Math.floor(Math.random() * 1e9);
};

const pickSample = (rng: () => number, samples: number[]) => {
  const index = Math.floor(rng() * samples.length);
  return samples[Math.max(0, Math.min(samples.length - 1, index))];
};

const percentileIndex = (p: number, n: number) => {
  const idx = Math.ceil(p * n) - 1;
  return Math.max(0, Math.min(n - 1, idx));
};

export const runMonteCarloForecast = (input: MonteCarloInput): MonteCarloForecast | null => {
  const remainingPoints = Number(input.remainingPoints || 0);
  if (!remainingPoints || remainingPoints <= 0) return null;
  const samples = (input.weeklySamples || []).map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
  if (!samples.length) return null;

  const iterations = Math.max(1, Math.floor(input.iterations || 0));
  if (!iterations) return null;
  const pLevels = (input.pLevels || [0.5, 0.8, 0.9]).filter((v) => v > 0 && v < 1).sort();
  const seed = resolveSeed(input.seed);
  const rng = mulberry32(seed);
  const startDate = input.startDate || new Date();
  const multiplier = Number(input.riskMultiplier || 1);
  const remainingPointsUsed = Number((remainingPoints * multiplier).toFixed(2));

  const finishDates: number[] = [];
  const maxWeeks = 260;

  for (let i = 0; i < iterations; i += 1) {
    let remaining = remainingPointsUsed;
    let weeks = 0;
    while (remaining > 0 && weeks < maxWeeks) {
      const throughput = pickSample(rng, samples);
      remaining -= throughput;
      weeks += 1;
    }
    const finish = startDate.getTime() + weeks * WEEK_MS;
    finishDates.push(finish);
  }

  finishDates.sort((a, b) => a - b);
  const total = finishDates.length;
  const mean = finishDates.reduce((sum, v) => sum + v, 0) / total;
  const variance = finishDates.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / total;
  const stdDev = Math.sqrt(variance);

  const levelMap: Record<string, string> = {};
  pLevels.forEach((p) => {
    const idx = percentileIndex(p, total);
    levelMap[p.toString()] = new Date(finishDates[idx]).toISOString();
  });

  const p50 = levelMap['0.5'] || levelMap[pLevels[0].toString()] || new Date(finishDates[0]).toISOString();
  const p80 = levelMap['0.8'] || p50;
  const p90 = levelMap['0.9'] || p80;

  let hitProbability = 0;
  if (input.endDate) {
    const endDate = new Date(input.endDate);
    if (!Number.isNaN(endDate.getTime())) {
      const hits = finishDates.filter((t) => t <= endDate.getTime()).length;
      hitProbability = Number((hits / total).toFixed(4));
    }
  }

  return {
    enabled: true,
    iterations,
    remainingPointsUsed,
    p50,
    p80,
    p90,
    hitProbability,
    mean: Number((mean / DAY_MS).toFixed(2)),
    stdDev: Number((stdDev / DAY_MS).toFixed(2))
  };
};
