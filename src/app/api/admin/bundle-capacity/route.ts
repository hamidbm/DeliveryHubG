import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../shared/events/emitEvent';
import { isAdminOrCmo } from '../../../../services/authz';
import { requireStandardUser } from '../../../../shared/auth/guards';
import { listBundleCapacity, saveBundleCapacity } from '../../../../server/db/repositories/bundleCapacityRepo';
import { listBundleRefs } from '../../../../server/db/repositories/bundlesRepo';

export async function GET() {
  try {
    const auth = await requireStandardUser();
    if (!auth.ok) return auth.response;
    const authUser = { userId: auth.principal.userId, role: auth.principal.role || undefined, email: auth.principal.email, id: auth.principal.userId };
    if (!(await isAdminOrCmo(authUser))) return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });

    const bundles = await listBundleRefs();
    const capacities = await listBundleCapacity();
    return NextResponse.json({
      bundles: bundles.map((b: any) => ({
        id: String(b._id || b.id || b.key || ''),
        name: String(b.name || b.title || b.key || b.id || b._id || '')
      })),
      capacities
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load bundle capacity' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const authUser = { userId: auth.principal.userId, role: auth.principal.role || undefined, email: auth.principal.email, id: auth.principal.userId };
    if (!(await isAdminOrCmo(authUser))) return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });

    const body = await request.json();
    const bundleId = String(body?.bundleId || '');
    const unit = body?.unit === 'POINTS_PER_SPRINT' ? 'POINTS_PER_SPRINT' : 'POINTS_PER_WEEK';
    const value = Number(body?.value || 0);
    if (!bundleId) return NextResponse.json({ error: 'bundleId required' }, { status: 400 });
    if (!Number.isFinite(value) || value < 0) return NextResponse.json({ error: 'value must be >= 0' }, { status: 400 });

    await saveBundleCapacity(bundleId, { unit, value }, String(authUser.userId || authUser.id || ''));

    await emitEvent({
      ts: new Date().toISOString(),
      type: 'bundle.capacity.updated',
      actor: {
        userId: String(authUser.userId || authUser.id || ''),
        displayName: authUser.email || authUser.userId || authUser.id || 'Admin'
      },
      resource: { type: 'bundle.capacity', id: bundleId, title: 'Bundle Capacity' },
      payload: { unit, value }
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update bundle capacity' }, { status: 500 });
  }
}
