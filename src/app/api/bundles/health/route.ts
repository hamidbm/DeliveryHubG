import { NextResponse } from 'next/server';
import { computeBundleHealth } from '../../../../services/db';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../services/visibility';

export async function GET(request: Request) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const bundleIds = searchParams.get('bundleIds');
    const list = bundleIds ? bundleIds.split(',').map((b) => b.trim()).filter(Boolean) : [];
    if (list.length === 0) return NextResponse.json({ bundles: [] });

    const visibility = createVisibilityContext(user);
    const visibleIds = (await Promise.all(list.map(async (id) => ({
      id,
      visible: await visibility.canViewBundle(id)
    })))).filter((entry) => entry.visible).map((entry) => entry.id);
    if (!visibleIds.length) return NextResponse.json({ bundles: [] });

    const bundles = await computeBundleHealth(visibleIds);
    return NextResponse.json({ bundles });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to compute bundle health' }, { status: 500 });
  }
}
