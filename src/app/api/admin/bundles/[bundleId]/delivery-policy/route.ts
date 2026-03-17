import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../../../shared/events/emitEvent';
import { isAdminOrCmo } from '../../../../../../services/authz';
import { deleteDeliveryPolicyOverride, getDeliveryPolicy, getDeliveryPolicyOverride, getEffectivePolicyForBundle, mergeDeliveryPolicy, saveDeliveryPolicyOverride, validateDeliveryPolicy } from '../../../../../../services/policy';
import { requireStandardUser } from '../../../../../../shared/auth/guards';

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
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const authUser = {
      userId: auth.principal.userId,
      role: auth.principal.role || '',
      team: auth.principal.team || ''
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
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const authUser = {
      userId: auth.principal.userId,
      role: auth.principal.role || '',
      team: auth.principal.team || ''
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
      await saveDeliveryPolicyOverride(bundleId, overrides, auth.principal.fullName || auth.principal.email || 'unknown');
    }

    const afterEffective = (await getEffectivePolicyForBundle(bundleId)).effective;
    const diff = buildDiffSummary(beforeEffective, afterEffective);
    const actor = {
      userId: auth.principal.userId || auth.principal.email || '',
      displayName: auth.principal.fullName || '',
      email: auth.principal.email,
      role: auth.principal.role || undefined
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
