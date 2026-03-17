
import { NextResponse } from 'next/server';
import { listBundles, saveBundleRecord } from '../../../server/db/repositories/bundlesRepo';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../services/visibility';
import { requireStandardUser } from '../../../shared/auth/guards';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('active') === 'true';
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const bundles = await listBundles(activeOnly);
  const visibility = createVisibilityContext(user);
  const visible = await visibility.filterVisibleBundles(bundles as any[]);
  return NextResponse.json(visible);
}

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const bundleData = await request.json();
    const result = await saveBundleRecord(bundleData);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save bundle' }, { status: 500 });
  }
}
