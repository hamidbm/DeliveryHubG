import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { fetchBundleProfile, upsertBundleProfile } from '../../../../../services/db';
import { canEditBundleProfile } from '../../../../../services/authz';
import { createVisibilityContext } from '../../../../../services/visibility';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUserFromCookies = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    name: String(payload.name || 'Unknown'),
    email: payload.email ? String(payload.email) : undefined,
    team: payload.team ? String(payload.team) : undefined
  };
};

const defaultProfile = (bundleId: string) => ({
  bundleId: String(bundleId),
  status: 'unknown' as const,
  statusSource: 'computed' as const,
  schedule: {
    milestones: []
  },
  notes: ''
});

export async function GET(request: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  try {
    const user = await getUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { bundleId } = await params;
    const visibility = createVisibilityContext(user);
    if (!(await visibility.canViewBundle(bundleId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const profile = await fetchBundleProfile(bundleId);
    return NextResponse.json(profile || defaultProfile(bundleId));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load bundle profile' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  try {
    const user = await getUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { bundleId } = await params;
    const visibility = createVisibilityContext(user);
    if (!(await visibility.canViewBundle(bundleId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const allowed = await canEditBundleProfile(user);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const payload = {
      bundleId: String(bundleId),
      status: body?.status || 'unknown',
      statusSource: body?.statusSource || 'computed',
      schedule: body?.schedule || { milestones: [] },
      notes: body?.notes || '',
      updatedBy: { userId: user.userId, name: user.name }
    };
    await upsertBundleProfile(bundleId, payload);
    const refreshed = await fetchBundleProfile(bundleId);
    return NextResponse.json(refreshed || payload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save bundle profile' }, { status: 500 });
  }
}
