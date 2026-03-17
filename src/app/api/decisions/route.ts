import { NextResponse } from 'next/server';
import { createVisibilityContext } from '../../../services/visibility';
import { canCreateDecisionForScope, createDecision, listDecisions } from '../../../services/decisionLog';
import { requireStandardUser, requireUser } from '../../../shared/auth/guards';
import { findBundleByAnyId } from '../../../server/db/repositories/bundlesRepo';
import { getMilestoneByRef } from '../../../server/db/repositories/milestonesRepo';
import { getWorkItemByAnyRef } from '../../../server/db/repositories/workItemsRepo';

const parseLimit = (value: string | null) => {
  const num = Number(value || 50);
  if (!Number.isFinite(num)) return 50;
  return Math.min(Math.max(num, 1), 200);
};

const DECISION_TYPES = new Set([
  'COMMIT_OVERRIDE',
  'READINESS_OVERRIDE',
  'CAPACITY_OVERRIDE',
  'SCOPE_APPROVAL',
  'RISK_ACCEPTED',
  'DATE_SLIP_ACCEPTED',
  'OTHER'
]);
const DECISION_OUTCOMES = new Set(['APPROVED', 'REJECTED', 'ACKNOWLEDGED']);
const DECISION_SEVERITIES = new Set(['info', 'warn', 'critical']);

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const authUser = auth.principal;
  const visibility = createVisibilityContext(authUser);
  const { searchParams } = new URL(request.url);
  const scopeType = String(searchParams.get('scopeType') || '').toUpperCase();
  const scopeId = searchParams.get('scopeId') ? String(searchParams.get('scopeId')) : undefined;
  const cursor = searchParams.get('cursor') ? String(searchParams.get('cursor')) : undefined;
  const limit = parseLimit(searchParams.get('limit'));

  if (!scopeType) return NextResponse.json({ error: 'Missing scopeType' }, { status: 400 });
  if (scopeType !== 'PROGRAM' && !scopeId) {
    return NextResponse.json({ error: 'Missing scopeId' }, { status: 400 });
  }

  if (scopeType === 'PROGRAM') {
    const items = await listDecisions({
      scopeType,
      scopeId: 'program',
      limit,
      cursor
    });
    const last = items[items.length - 1];
    const nextCursor = last?.createdAt && last?._id ? `${last.createdAt}|${last._id}` : null;
    return NextResponse.json({ items, nextCursor });
  }
  if (scopeType === 'BUNDLE' && scopeId) {
    const bundle = await findBundleByAnyId(scopeId);
    if (!bundle) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!(await visibility.canViewBundle(String(bundle._id || bundle.id || scopeId)))) {
      return NextResponse.json({ error: 'Forbidden', code: 'BUNDLE_RESTRICTED' }, { status: 403 });
    }
  }
  if (scopeType === 'MILESTONE' && scopeId) {
    const milestone = await getMilestoneByRef(scopeId);
    if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!(await visibility.canViewBundle(String(milestone.bundleId || '')))) {
      return NextResponse.json({ error: 'Forbidden', code: 'BUNDLE_RESTRICTED' }, { status: 403 });
    }
  }
  if (scopeType === 'WORK_ITEM' && scopeId) {
    const item = await getWorkItemByAnyRef(scopeId);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const visible = await visibility.filterVisibleWorkItems([{ ...item, _id: String(item._id) } as any]);
    if (!visible.length) {
      return NextResponse.json({ error: 'Forbidden', code: 'BUNDLE_RESTRICTED' }, { status: 403 });
    }
  }

  const items = await listDecisions({
    scopeType,
    scopeId,
    limit,
    cursor
  });
  const last = items[items.length - 1];
  const nextCursor = last?.createdAt && last?._id ? `${last.createdAt}|${last._id}` : null;
  return NextResponse.json({ items, nextCursor });
}

export async function POST(request: Request) {
  const auth = await requireStandardUser(request);
  if (!auth.ok) return auth.response;
  const authUser = auth.principal;
  const body = await request.json().catch(() => ({}));
  const scopeType = String(body?.scopeType || '').toUpperCase();
  let scopeId = body?.scopeId ? String(body.scopeId) : undefined;
  const decisionType = String(body?.decisionType || '').toUpperCase();
  const title = String(body?.title || '').trim();
  const rationale = String(body?.rationale || '').trim();
  const outcome = String(body?.outcome || '').toUpperCase();
  const severity = String(body?.severity || 'info').toLowerCase();
  if (!scopeType || !title || !rationale) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!DECISION_TYPES.has(decisionType)) {
    return NextResponse.json({ error: 'Invalid decisionType' }, { status: 400 });
  }
  if (!DECISION_OUTCOMES.has(outcome)) {
    return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 });
  }
  if (!DECISION_SEVERITIES.has(severity)) {
    return NextResponse.json({ error: 'Invalid severity' }, { status: 400 });
  }

  let bundleId: string | undefined;
  if (scopeType !== 'PROGRAM' && !scopeId) {
    return NextResponse.json({ error: 'Missing scopeId' }, { status: 400 });
  }
  if (scopeType === 'BUNDLE' && scopeId) {
    const bundle = await findBundleByAnyId(scopeId);
    if (!bundle) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    bundleId = String(bundle._id || bundle.id || scopeId);
  }
  if (scopeType === 'MILESTONE' && scopeId) {
    const milestone = await getMilestoneByRef(scopeId);
    if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    bundleId = String(milestone.bundleId || '');
  }
  if (scopeType === 'WORK_ITEM' && scopeId) {
    const item = await getWorkItemByAnyRef(scopeId);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    bundleId = String(item.bundleId || '');
  }

  if (scopeType === 'PROGRAM') {
    scopeId = 'program';
  }

  const allowed = await canCreateDecisionForScope(authUser, scopeType as any, bundleId);
  if (!allowed) return NextResponse.json({ error: 'FORBIDDEN_DECISION_CREATE' }, { status: 403 });

  const created = await createDecision({
    createdAt: new Date().toISOString(),
    createdBy: {
      userId: String(authUser.userId || ''),
      email: String(authUser.email || ''),
      name: authUser.fullName ? String(authUser.fullName) : undefined
    },
    source: 'MANUAL',
    scopeType: scopeType as any,
    scopeId: scopeId,
    decisionType: decisionType as any,
    title,
    rationale,
    alternatives: body?.alternatives ? String(body.alternatives) : undefined,
    outcome: outcome as any,
    severity: severity as any,
    related: body?.related || undefined,
    tags: Array.isArray(body?.tags) ? body.tags.filter(Boolean) : undefined
  });

  return NextResponse.json({ decision: created });
}
