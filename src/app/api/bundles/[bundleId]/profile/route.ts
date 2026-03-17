import { NextResponse } from 'next/server';
import { getBundleProfile, saveBundleProfile } from '../../../../../server/db/repositories/bundlesRepo';
import { canEditBundleProfile } from '../../../../../services/authz';
import { createVisibilityContext } from '../../../../../services/visibility';
import { requireStandardUser, requireUser } from '../../../../../shared/auth/guards';

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
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      name: auth.principal.fullName || 'Unknown',
      email: auth.principal.email,
      team: auth.principal.team || undefined,
      accountType: auth.principal.accountType
    };

    const { bundleId } = await params;
    const visibility = createVisibilityContext(user);
    if (!(await visibility.canViewBundle(bundleId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const profile = await getBundleProfile(bundleId);
    return NextResponse.json(profile || defaultProfile(bundleId));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load bundle profile' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      name: auth.principal.fullName || 'Unknown',
      email: auth.principal.email,
      team: auth.principal.team || undefined,
      accountType: auth.principal.accountType
    };
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
    await saveBundleProfile(bundleId, payload);
    const refreshed = await getBundleProfile(bundleId);
    return NextResponse.json(refreshed || payload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save bundle profile' }, { status: 500 });
  }
}
