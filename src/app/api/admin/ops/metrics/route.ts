import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getDb } from '../../../../../services/db';
import { isAdminOrCmo } from '../../../../../services/authz';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUser = async () => {
  const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
  const cookieStore = testToken ? null : await cookies();
  const token = testToken || cookieStore?.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    role: payload.role ? String(payload.role) : undefined,
    email: payload.email ? String(payload.email) : undefined
  };
};

const requireAdmin = async () => {
  const user = await getUser();
  if (!user?.userId) return { ok: false, status: 401, user: null };
  const allowed = await isAdminOrCmo(user);
  if (!allowed) return { ok: false, status: 403, user };
  return { ok: true, status: 200, user };
};

const clampWindow = (value: string | null) => {
  const parsed = Number(value || 7);
  if (!Number.isFinite(parsed)) return 7;
  return Math.min(Math.max(parsed, 1), 30);
};

const percentile = (values: number[], p: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
};

const normalizeOk = (payload: any) => {
  if (payload?.ok === false) return false;
  if (payload?.error) return false;
  return true;
};

const normalizeDuration = (payload: any) => {
  const value = Number(payload?.durationMs);
  return Number.isFinite(value) ? value : null;
};

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const windowDays = clampWindow(searchParams.get('windowDays'));
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const db = await getDb();

    const jobGroups = [
      { name: 'Commit Drift', types: ['perf.commitdrift.run'] },
      { name: 'Daily Digest', types: ['perf.digest.run', 'perf.digestRun'] },
      { name: 'Weekly Brief', types: ['perf.weeklybrief.run'] },
      { name: 'GitHub Sync', types: ['integrations.github.sync.completed'] }
    ];
    const apiTypes = new Set([
      'perf.roadmap.intel',
      'perf.roadmapIntel',
      'perf.milestone.rollups',
      'perf.milestoneRollups',
      'perf.program.intel',
      'perf.capacity.plan',
      'perf.api.latency'
    ]);

    const perfEvents = await db.collection('events').find({
      ts: { $gte: since },
      type: { $in: [...jobGroups.flatMap((g) => g.types), ...apiTypes] }
    }).toArray();

    const jobs: any[] = [];
    jobGroups.forEach((group) => {
      const entries = perfEvents.filter((e: any) => group.types.includes(e.type));
      if (!entries.length) {
        jobs.push({ name: group.name, type: group.types[0], lastRunAt: null, lastDurationMs: null, lastOk: null, failuresLast7d: 0, avgDurationMs: null });
        return;
      }
      const sorted = entries.sort((a: any, b: any) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
      const last = sorted[0];
      const durations = entries.map((e: any) => normalizeDuration(e.payload)).filter((v: any) => v !== null) as number[];
      const avgDurationMs = durations.length ? Math.round(durations.reduce((sum, v) => sum + v, 0) / durations.length) : null;
      const failuresLast7d = entries.filter((e: any) => !normalizeOk(e.payload)).length;
      jobs.push({
        name: group.name,
        type: group.types[0],
        lastRunAt: last?.ts ? new Date(last.ts).toISOString() : null,
        lastDurationMs: normalizeDuration(last?.payload),
        lastOk: normalizeOk(last?.payload),
        failuresLast7d,
        avgDurationMs
      });
    });

    const apiMap = new Map<string, { durations: number[]; errors: number; total: number }>();
    perfEvents.filter((e: any) => apiTypes.has(e.type)).forEach((event: any) => {
      const payload = event.payload || {};
      const name = payload.name || event.type;
      const duration = normalizeDuration(payload);
      if (duration === null) return;
      if (!apiMap.has(name)) apiMap.set(name, { durations: [], errors: 0, total: 0 });
      const bucket = apiMap.get(name)!;
      bucket.durations.push(duration);
      bucket.total += 1;
      if (!normalizeOk(payload)) bucket.errors += 1;
    });

    const apis = Array.from(apiMap.entries()).map(([name, bucket]) => ({
      name,
      count: bucket.total,
      p50: percentile(bucket.durations, 50),
      p95: percentile(bucket.durations, 95),
      errorRate: bucket.total ? Number((bucket.errors / bucket.total).toFixed(3)) : 0
    }));

    const cacheTotals: Record<string, { hits: number; misses: number }> = {};
    perfEvents.forEach((event: any) => {
      const payload = event.payload || {};
      if (payload.cacheByName && typeof payload.cacheByName === 'object') {
        Object.entries(payload.cacheByName).forEach(([name, stats]: any) => {
          if (!cacheTotals[name]) cacheTotals[name] = { hits: 0, misses: 0 };
          cacheTotals[name].hits += Number(stats?.hits || 0);
          cacheTotals[name].misses += Number(stats?.misses || 0);
        });
      } else if (payload.cacheName && payload.cache) {
        const name = String(payload.cacheName);
        if (!cacheTotals[name]) cacheTotals[name] = { hits: 0, misses: 0 };
        cacheTotals[name].hits += Number(payload.cache.hits || 0);
        cacheTotals[name].misses += Number(payload.cache.misses || 0);
      }
    });

    const cache = Object.entries(cacheTotals).map(([name, stats]) => {
      const total = stats.hits + stats.misses;
      return {
        name,
        hits: stats.hits,
        misses: stats.misses,
        hitRate: total ? Number((stats.hits / total).toFixed(3)) : 0
      };
    });

    const notifAgg = await db.collection('notifications').aggregate([
      { $addFields: { createdAtDate: { $toDate: '$createdAt' } } },
      { $match: { createdAtDate: { $gte: since } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAtDate' } },
            type: '$type'
          },
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const byDayMap: Record<string, Record<string, number>> = {};
    const totalsByType: Record<string, number> = {};
    notifAgg.forEach((row: any) => {
      const day = row._id?.day || 'unknown';
      const type = row._id?.type || 'unknown';
      if (!byDayMap[day]) byDayMap[day] = {};
      byDayMap[day][type] = row.count;
      totalsByType[type] = (totalsByType[type] || 0) + row.count;
    });

    const notifications = {
      byDay: Object.entries(byDayMap).map(([day, counts]) => ({ day, counts })),
      totalsByType
    };

    return NextResponse.json({ windowDays, since: since.toISOString(), jobs, apis, cache, notifications });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load metrics' }, { status: 500 });
  }
}
