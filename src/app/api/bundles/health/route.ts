import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { computeBundleHealth } from '../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const requireAuth = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return false;
  await jwtVerify(token, JWT_SECRET);
  return true;
};

export async function GET(request: Request) {
  try {
    const ok = await requireAuth();
    if (!ok) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const bundleIds = searchParams.get('bundleIds');
    const list = bundleIds ? bundleIds.split(',').map((b) => b.trim()).filter(Boolean) : [];
    if (list.length === 0) return NextResponse.json({ bundles: [] });

    const bundles = await computeBundleHealth(list);
    return NextResponse.json({ bundles });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to compute bundle health' }, { status: 500 });
  }
}
