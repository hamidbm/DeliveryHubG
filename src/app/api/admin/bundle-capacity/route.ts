import { NextResponse } from 'next/server';
import { getDb, emitEvent, fetchBundleCapacity, upsertBundleCapacity } from '../../../../services/db';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { isAdminOrCmo } from '../../../../services/authz';

export async function GET() {
  try {
    const authUser = await getAuthUserFromCookies();
    if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    if (!(await isAdminOrCmo(authUser))) return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });

    const db = await getDb();
    const bundles = await db.collection('bundles').find({}, { projection: { _id: 1, name: 1, title: 1 } }).sort({ name: 1 }).toArray();
    const capacities = await fetchBundleCapacity();
    return NextResponse.json({
      bundles: bundles.map((b: any) => ({
        id: String(b._id || b.id || b.key || ''),
        name: String(b.name || b.title || b._id || '')
      })),
      capacities
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load bundle capacity' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authUser = await getAuthUserFromCookies();
    if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    if (!(await isAdminOrCmo(authUser))) return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });

    const body = await request.json();
    const bundleId = String(body?.bundleId || '');
    const unit = body?.unit === 'POINTS_PER_SPRINT' ? 'POINTS_PER_SPRINT' : 'POINTS_PER_WEEK';
    const value = Number(body?.value || 0);
    if (!bundleId) return NextResponse.json({ error: 'bundleId required' }, { status: 400 });
    if (!Number.isFinite(value) || value < 0) return NextResponse.json({ error: 'value must be >= 0' }, { status: 400 });

    await upsertBundleCapacity(bundleId, { unit, value }, String(authUser.userId || authUser.id || ''));

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
