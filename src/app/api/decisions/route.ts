import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../services/db';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../services/visibility';
import { canCreateDecisionForScope, createDecision, listDecisions } from '../../../services/decisionLog';

const parseLimit = (value: string | null) => {
  const num = Number(value || 50);
  if (!Number.isFinite(num)) return 50;
  return Math.min(Math.max(num, 1), 200);
};

const buildMilestoneQuery = (id: string) => {
  if (ObjectId.isValid(id)) {
    return { $or: [{ _id: new ObjectId(id) }, { id }, { name: id }] };
  }
  return { $or: [{ id }, { name: id }] };
};

const buildBundleQuery = (id: string) => {
  if (ObjectId.isValid(id)) {
    return { $or: [{ _id: new ObjectId(id) }, { id }, { name: id }] };
  }
  return { $or: [{ id }, { name: id }] };
};

const buildWorkItemQuery = (id: string) => {
  if (ObjectId.isValid(id)) {
    return { $or: [{ _id: new ObjectId(id) }, { id }, { key: id }] };
  }
  return { $or: [{ id }, { key: id }] };
};

export async function GET(request: Request) {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const visibility = createVisibilityContext(authUser);
  const { searchParams } = new URL(request.url);
  const scopeType = String(searchParams.get('scopeType') || '').toUpperCase();
  const scopeId = searchParams.get('scopeId') ? String(searchParams.get('scopeId')) : undefined;
  const cursor = searchParams.get('cursor') ? String(searchParams.get('cursor')) : undefined;
  const limit = parseLimit(searchParams.get('limit'));

  if (!scopeType) return NextResponse.json({ error: 'Missing scopeType' }, { status: 400 });

  const db = await getDb();
  if (scopeType === 'BUNDLE' && scopeId) {
    const bundle = await db.collection('bundles').findOne(buildBundleQuery(scopeId));
    if (!bundle) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!(await visibility.canViewBundle(String(bundle._id || bundle.id || scopeId)))) {
      return NextResponse.json({ error: 'Forbidden', code: 'BUNDLE_RESTRICTED' }, { status: 403 });
    }
  }
  if (scopeType === 'MILESTONE' && scopeId) {
    const milestone = await db.collection('milestones').findOne(buildMilestoneQuery(scopeId));
    if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!(await visibility.canViewBundle(String(milestone.bundleId || '')))) {
      return NextResponse.json({ error: 'Forbidden', code: 'BUNDLE_RESTRICTED' }, { status: 403 });
    }
  }
  if (scopeType === 'WORK_ITEM' && scopeId) {
    const item = await db.collection('workitems').findOne(buildWorkItemQuery(scopeId));
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
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const scopeType = String(body?.scopeType || '').toUpperCase();
  let scopeId = body?.scopeId ? String(body.scopeId) : undefined;
  const decisionType = String(body?.decisionType || 'OTHER');
  const title = String(body?.title || '').trim();
  const rationale = String(body?.rationale || '').trim();
  if (!scopeType || !title || !rationale) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const db = await getDb();
  let bundleId: string | undefined;
  if (scopeType === 'BUNDLE' && scopeId) {
    const bundle = await db.collection('bundles').findOne(buildBundleQuery(scopeId));
    if (!bundle) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    bundleId = String(bundle._id || bundle.id || scopeId);
  }
  if (scopeType === 'MILESTONE' && scopeId) {
    const milestone = await db.collection('milestones').findOne(buildMilestoneQuery(scopeId));
    if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    bundleId = String(milestone.bundleId || '');
  }
  if (scopeType === 'WORK_ITEM' && scopeId) {
    const item = await db.collection('workitems').findOne(buildWorkItemQuery(scopeId));
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
      name: (authUser as any).name ? String((authUser as any).name) : undefined
    },
    scopeType: scopeType as any,
    scopeId: scopeId,
    decisionType: decisionType as any,
    title,
    rationale,
    alternatives: body?.alternatives ? String(body.alternatives) : undefined,
    outcome: (body?.outcome || 'ACKNOWLEDGED') as any,
    severity: (body?.severity || 'info') as any,
    related: body?.related || undefined,
    tags: Array.isArray(body?.tags) ? body.tags.filter(Boolean) : undefined
  });

  return NextResponse.json({ decision: created });
}
