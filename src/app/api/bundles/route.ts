
import { NextResponse } from 'next/server';
import { fetchBundles, saveBundle } from '../../../services/db';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../services/visibility';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { Role } from '../../../types';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('active') === 'true';
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const bundles = await fetchBundles(activeOnly);
  const visibility = createVisibilityContext(user);
  const visible = await visibility.filterVisibleBundles(bundles as any[]);
  return NextResponse.json(visible);
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    // TEMPORARY: Suspended role check for implementation phase
    /*
    if (payload.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Unauthorized: Admin role required' }, { status: 403 });
    }
    */

    const bundleData = await request.json();
    const result = await saveBundle(bundleData, payload);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save bundle' }, { status: 500 });
  }
}
