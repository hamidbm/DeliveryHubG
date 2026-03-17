import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../shared/events/emitEvent';
import { computeBundleCapacityPlans } from '../../../../services/capacityPlanning';
import { createVisibilityContext } from '../../../../services/visibility';
import { snapshotCacheStats, diffCacheStats, summarizeCacheStats } from '../../../../services/perfStats';
import { requireUser } from '../../../../shared/auth/guards';
import { listBundleRefs } from '../../../../server/db/repositories/bundlesRepo';

const parseList = (value: string | null) =>
  value ? value.split(',').map((v) => v.trim()).filter(Boolean) : [];

export async function GET(request: Request) {
  try {
    const startTime = Date.now();
    const cacheBefore = snapshotCacheStats();
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const authUser = {
      userId: auth.principal.userId,
      role: auth.principal.role || undefined,
      email: auth.principal.email,
      accountType: auth.principal.accountType
    };
    const visibility = createVisibilityContext(authUser);

    const { searchParams } = new URL(request.url);
    const bundleIdsRaw = parseList(searchParams.get('bundleIds'));
    const horizonWeeks = Math.max(1, Number(searchParams.get('horizonWeeks') || 12));

    let bundleIds: string[] = [];
    if (bundleIdsRaw.length) {
      const checks = await Promise.all(bundleIdsRaw.map(async (id) => ({
        id,
        visible: await visibility.canViewBundle(id)
      })));
      bundleIds = checks.filter((b) => b.visible).map((b) => b.id);
    } else {
      const bundles = await listBundleRefs();
      const ids = bundles.map((b: any) => String(b._id || b.id || b.key || '')).filter(Boolean);
      const checks = await Promise.all(ids.map(async (id) => ({
        id,
        visible: await visibility.canViewBundle(id)
      })));
      bundleIds = checks.filter((b) => b.visible).map((b) => b.id);
    }

    if (!bundleIds.length) {
      return NextResponse.json({ bundlePlans: [], atRiskBundles: [], recommendedActions: [] });
    }

    const data = await computeBundleCapacityPlans(bundleIds, horizonWeeks);
    const durationMs = Date.now() - startTime;
    const cacheAfter = snapshotCacheStats();
    const cacheDelta = diffCacheStats(cacheBefore, cacheAfter);
    const cacheSummary = summarizeCacheStats(cacheDelta);
    try {
      await emitEvent({
        ts: new Date().toISOString(),
        type: 'perf.capacity.plan',
        actor: { userId: authUser.userId, email: authUser.email, displayName: auth.principal.fullName || authUser.userId },
        resource: { type: 'capacity.plan', id: 'capacity-plan', title: 'Capacity Plan' },
        payload: {
          name: 'api.capacity.plan',
          at: new Date().toISOString(),
          durationMs,
          ok: true,
          scope: {
            bundleId: bundleIds.join(',')
          },
          counts: {
            bundles: bundleIds.length,
            horizonWeeks
          },
          cache: cacheSummary,
          cacheByName: cacheDelta
        }
      });
    } catch {}
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to compute capacity plan' }, { status: 500 });
  }
}
