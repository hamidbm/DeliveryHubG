export type CacheStats = Record<string, { hits: number; misses: number }>;

const cacheStats = new Map<string, { hits: number; misses: number }>();

const ensure = (name: string) => {
  const key = String(name || 'default');
  if (!cacheStats.has(key)) {
    cacheStats.set(key, { hits: 0, misses: 0 });
  }
  return cacheStats.get(key) as { hits: number; misses: number };
};

export const recordCacheHit = (name: string) => {
  const stat = ensure(name);
  stat.hits += 1;
};

export const recordCacheMiss = (name: string) => {
  const stat = ensure(name);
  stat.misses += 1;
};

export const snapshotCacheStats = (): CacheStats => {
  const snapshot: CacheStats = {};
  cacheStats.forEach((value, key) => {
    snapshot[key] = { hits: value.hits, misses: value.misses };
  });
  return snapshot;
};

export const diffCacheStats = (before: CacheStats, after: CacheStats): CacheStats => {
  const diff: CacheStats = {};
  const names = new Set<string>([...Object.keys(before || {}), ...Object.keys(after || {})]);
  names.forEach((name) => {
    const b = before?.[name] || { hits: 0, misses: 0 };
    const a = after?.[name] || { hits: 0, misses: 0 };
    const hits = a.hits - b.hits;
    const misses = a.misses - b.misses;
    if (hits || misses) {
      diff[name] = { hits, misses };
    }
  });
  return diff;
};

export const summarizeCacheStats = (stats: CacheStats) => {
  let hits = 0;
  let misses = 0;
  Object.values(stats || {}).forEach((entry) => {
    hits += entry.hits || 0;
    misses += entry.misses || 0;
  });
  return { hits, misses };
};
