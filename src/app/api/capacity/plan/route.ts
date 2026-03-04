import { NextResponse } from 'next/server';
import { getDb } from '../../../../services/db';
import { computeBundleCapacityPlans } from '../../../../services/capacityPlanning';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../services/visibility';

const parseList = (value: string | null) =>
  value ? value.split(',').map((v) => v.trim()).filter(Boolean) : [];

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserFromCookies();
    if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const visibility = createVisibilityContext(authUser);

    const { searchParams } = new URL(request.url);
    const bundleIdsRaw = parseList(searchParams.get('bundleIds'));
    const horizonWeeks = Math.max(1, Number(searchParams.get('horizonWeeks') || 12));

    const db = await getDb();
    let bundleIds: string[] = [];
    if (bundleIdsRaw.length) {
      const checks = await Promise.all(bundleIdsRaw.map(async (id) => ({
        id,
        visible: await visibility.canViewBundle(id)
      })));
      bundleIds = checks.filter((b) => b.visible).map((b) => b.id);
    } else {
      const bundles = await db.collection('bundles').find({}, { projection: { _id: 1 } }).toArray();
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
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to compute capacity plan' }, { status: 500 });
  }
}
