import { NextResponse } from 'next/server';
import { listBundleProfiles } from '../../../server/db/repositories/bundlesRepo';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../services/visibility';

export async function GET(request: Request) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const bundleIds = searchParams.get('bundleIds');
    const bundleIdList = bundleIds ? bundleIds.split(',').map((b) => b.trim()).filter(Boolean) : undefined;
    const visibility = createVisibilityContext(user);
    const visibleIds = bundleIdList
      ? (await Promise.all(bundleIdList.map(async (id) => ({
        id,
        visible: await visibility.canViewBundle(id)
      })))).filter((entry) => entry.visible).map((entry) => entry.id)
      : undefined;
    const profiles = await listBundleProfiles(visibleIds);
    return NextResponse.json(profiles);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch bundle profiles' }, { status: 500 });
  }
}
