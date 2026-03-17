import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../shared/events/emitEvent';
import { isAdminOrCmo } from '../../../../services/authz';
import { getDeliveryPolicy, getDefaultDeliveryPolicy, normalizeDeliveryPolicy, saveDeliveryPolicy, validateDeliveryPolicy } from '../../../../services/policy';
import { requireStandardUser } from '../../../../shared/auth/guards';

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

export async function GET(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const authUser = {
      userId: auth.principal.userId,
      role: String(auth.principal.role || ''),
      team: String(auth.principal.team || ''),
      accountType: auth.principal.accountType
    };
    if (!(await isAdminOrCmo(authUser))) {
      return NextResponse.json({ error: 'FORBIDDEN_POLICY_READ' }, { status: 403 });
    }

    const policy = await getDeliveryPolicy();
    return NextResponse.json({ policy });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load delivery policy' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const authUser = {
      userId: auth.principal.userId,
      role: String(auth.principal.role || ''),
      team: String(auth.principal.team || ''),
      accountType: auth.principal.accountType
    };
    if (!(await isAdminOrCmo(authUser))) {
      return NextResponse.json({ error: 'FORBIDDEN_POLICY_UPDATE' }, { status: 403 });
    }

    const incoming = await request.json();
    const validation = validateDeliveryPolicy(incoming);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error || 'Invalid policy' }, { status: 400 });
    }

    const existing = await getDeliveryPolicy();
    const normalized = normalizeDeliveryPolicy(incoming);
    const next = {
      ...normalized,
      _id: 'global' as const,
      version: (existing?.version || 0) + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.principal.fullName || auth.principal.email || 'unknown'
    };

    const saved = await saveDeliveryPolicy(next);

    const diff = buildDiffSummary(existing || getDefaultDeliveryPolicy(), next);
    const actor = {
      userId: auth.principal.userId,
      displayName: auth.principal.fullName || '',
      email: auth.principal.email,
      role: auth.principal.role || undefined
    };
    await emitEvent({
      ts: new Date().toISOString(),
      type: 'policy.updated',
      actor,
      resource: { type: 'settings.delivery_policy', id: 'global', title: 'Delivery Policy' },
      payload: { diff }
    });

    return NextResponse.json({ policy: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update policy' }, { status: 500 });
  }
}
