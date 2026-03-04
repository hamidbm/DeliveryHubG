import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { emitEvent } from '../../../../../../services/db';
import { isAdminOrCmo } from '../../../../../../services/authz';
import { deleteDeliveryPolicyOverride, getDeliveryPolicy, getDeliveryPolicyOverride, getEffectivePolicyForBundle, mergeDeliveryPolicy, saveDeliveryPolicyOverride, validateDeliveryPolicy } from '../../../../../../services/policy';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getAuthUser = async () => {
  const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
  const cookieStore = testToken ? null : await cookies();
  const token = testToken || cookieStore?.get('nexus_auth_token')?.value;
  if (!token) return { token: null, payload: null };
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return { token, payload };
};

const buildDiffSummary = (before: any, after: any) => {
  const changes: string[] = [];
  const check = (key: string, path: string) => {
    const prev = JSON.stringify(before?.[key]);
    const next = JSON.stringify(after?.[key]);
    if (prev !== next) changes.push(path);
  };
  check('readiness', 'readiness');
  check('dataQuality', 'dataQuality');
  check('forecasting', 'forecasting');
  check('criticalPath', 'criticalPath');
  return changes;
};

export async function GET(request: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  try {
    const { token, payload } = await getAuthUser();
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const authUser = {
      userId: String((payload as any).id || (payload as any).userId || ''),
      role: String((payload as any).role || ''),
      team: String((payload as any).team || '')
    };
    if (!(await isAdminOrCmo(authUser))) {
      return NextResponse.json({ error: 'FORBIDDEN_POLICY_READ' }, { status: 403 });
    }

    const { bundleId } = await params;
    const override = await getDeliveryPolicyOverride(bundleId);
    const effective = await getEffectivePolicyForBundle(bundleId);
    return NextResponse.json({
      bundleId,
      override,
      effective: effective.effective,
      refs: effective.refs,
      hasOverrides: effective.hasOverrides
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load bundle policy' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  try {
    const { token, payload } = await getAuthUser();
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const authUser = {
      userId: String((payload as any).id || (payload as any).userId || ''),
      role: String((payload as any).role || ''),
      team: String((payload as any).team || '')
    };
    if (!(await isAdminOrCmo(authUser))) {
      return NextResponse.json({ error: 'FORBIDDEN_POLICY_UPDATE' }, { status: 403 });
    }

    const { bundleId } = await params;
    const body = await request.json().catch(() => ({}));
    const overrides = body?.overrides || {};
    const reset = Boolean(body?.reset);

    const globalPolicy = await getDeliveryPolicy();
    const beforeEffective = (await getEffectivePolicyForBundle(bundleId)).effective;

    if (reset || !overrides || Object.keys(overrides).length === 0) {
      await deleteDeliveryPolicyOverride(bundleId);
    } else {
      const merged = mergeDeliveryPolicy(globalPolicy, overrides);
      const validation = validateDeliveryPolicy(merged);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error || 'Invalid override' }, { status: 400 });
      }
      await saveDeliveryPolicyOverride(bundleId, overrides, String((payload as any).name || (payload as any).email || 'unknown'));
    }

    const afterEffective = (await getEffectivePolicyForBundle(bundleId)).effective;
    const diff = buildDiffSummary(beforeEffective, afterEffective);
    const actor = {
      userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
      displayName: String((payload as any).name || (payload as any).displayName || ''),
      email: (payload as any).email ? String((payload as any).email) : undefined,
      role: (payload as any).role ? String((payload as any).role) : undefined
    };
    await emitEvent({
      ts: new Date().toISOString(),
      type: 'policy.bundle.updated',
      actor,
      resource: { type: 'settings.delivery_policy', id: String(bundleId), title: 'Bundle Policy Override' },
      payload: { diff, bundleId }
    });

    const effective = await getEffectivePolicyForBundle(bundleId);
    return NextResponse.json({
      bundleId,
      override: await getDeliveryPolicyOverride(bundleId),
      effective: effective.effective,
      refs: effective.refs,
      hasOverrides: effective.hasOverrides
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update bundle policy' }, { status: 500 });
  }
}
