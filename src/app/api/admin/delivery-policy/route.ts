import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { emitEvent } from '../../../../services/db';
import { isAdminOrCmo } from '../../../../services/authz';
import { getDeliveryPolicy, getDefaultDeliveryPolicy, normalizeDeliveryPolicy, saveDeliveryPolicy, validateDeliveryPolicy } from '../../../../services/policy';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

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

const getAuthUser = async () => {
  const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
  const cookieStore = testToken ? null : await cookies();
  const token = testToken || cookieStore?.get('nexus_auth_token')?.value;
  if (!token) return { token: null, payload: null };
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return { token, payload };
};

export async function GET() {
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

    const policy = await getDeliveryPolicy();
    return NextResponse.json({ policy });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load delivery policy' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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
      updatedBy: String((payload as any).name || (payload as any).displayName || (payload as any).email || 'unknown')
    };

    const saved = await saveDeliveryPolicy(next);

    const diff = buildDiffSummary(existing || getDefaultDeliveryPolicy(), next);
    const actor = {
      userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
      displayName: String((payload as any).name || (payload as any).displayName || ''),
      email: (payload as any).email ? String((payload as any).email) : undefined,
      role: (payload as any).role ? String((payload as any).role) : undefined
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
