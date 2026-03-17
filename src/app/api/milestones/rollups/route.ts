import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../shared/events/emitEvent';
import { fetchMilestones } from '../../../../services/workItemsService';
import { computeMilestoneRollups } from '../../../../services/rollupAnalytics';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../services/visibility';
import { snapshotCacheStats, diffCacheStats, summarizeCacheStats } from '../../../../services/perfStats';
import { requireUser } from '../../../../shared/auth/guards';

export async function GET(request: Request) {
  const startTime = Date.now();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const visibility = createVisibilityContext(authUser);
  const { searchParams } = new URL(request.url);
  const milestoneIds = searchParams.get('milestoneIds');
  const cacheBefore = snapshotCacheStats();

  let ids: string[] = [];
  if (milestoneIds) {
    ids = milestoneIds.split(',').map((id) => id.trim()).filter(Boolean);
  } else {
    const filters = {
      bundleId: searchParams.get('bundleId'),
      applicationId: searchParams.get('applicationId'),
      status: searchParams.get('status')
    };
    const milestones = await fetchMilestones(filters);
    const visible = await Promise.all(milestones.map(async (m: any) => ({
      milestone: m,
      visible: await visibility.canViewBundle(String(m.bundleId || ''))
    })));
    ids = visible.filter((m) => m.visible).map((m) => String(m.milestone._id || m.milestone.id || m.milestone.name)).filter(Boolean);
  }

  if (ids.length === 0) return NextResponse.json([]);

  ids = await visibility.filterVisibleMilestoneIds(ids);
  if (ids.length === 0) return NextResponse.json([]);

  const rollups = await computeMilestoneRollups(ids);
  const durationMs = Date.now() - startTime;
  const cacheAfter = snapshotCacheStats();
  const cacheDelta = diffCacheStats(cacheBefore, cacheAfter);
  const cacheSummary = summarizeCacheStats(cacheDelta);
  console.info('[perf] milestone-rollups', { durationMs, milestones: ids.length });
  try {
    const actor = {
      userId: auth.principal.userId,
      displayName: auth.principal.fullName || auth.principal.email || 'Unknown',
      email: auth.principal.email
    };
    await emitEvent({
      ts: new Date().toISOString(),
      type: 'perf.milestone.rollups',
      actor,
      resource: { type: 'milestones.rollups', id: 'milestone-rollups', title: 'Milestone Rollups' },
      payload: {
        name: 'api.milestones.rollups',
        at: new Date().toISOString(),
        durationMs,
        ok: true,
        scope: {
          bundleId: searchParams.get('bundleId') || undefined,
          applicationId: searchParams.get('applicationId') || undefined
        },
        counts: { milestones: ids.length },
        cache: cacheSummary,
        cacheByName: cacheDelta
      }
    });
  } catch {}

  return NextResponse.json(rollups);
}
