import { NextResponse } from 'next/server';
import { computeMilestoneRollups, fetchMilestones, emitEvent } from '../../../../services/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../services/visibility';
import { snapshotCacheStats, diffCacheStats, summarizeCacheStats } from '../../../../services/perfStats';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function GET(request: Request) {
  const startTime = Date.now();
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
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    let actor: any = undefined;
    if (token) {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      actor = {
        userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
        displayName: String((payload as any).name || (payload as any).displayName || ''),
        email: (payload as any).email ? String((payload as any).email) : undefined
      };
    }
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
