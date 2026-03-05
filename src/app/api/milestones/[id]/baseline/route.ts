import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../services/db';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../../services/visibility';
import { getMilestoneBaseline } from '../../../../../services/baselineDelta';

const buildMilestoneQuery = (id: string) => {
  if (ObjectId.isValid(id)) {
    return { $or: [{ _id: new ObjectId(id) }, { id }, { name: id }] };
  }
  return { $or: [{ id }, { name: id }] };
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const visibility = createVisibilityContext(authUser);

  const db = await getDb();
  const milestone = await db.collection('milestones').findOne(buildMilestoneQuery(id));
  if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await visibility.canViewBundle(String(milestone.bundleId || '')))) {
    return NextResponse.json({ error: 'Forbidden', code: 'BUNDLE_RESTRICTED' }, { status: 403 });
  }

  const baseline = await getMilestoneBaseline(String(milestone._id || milestone.id || milestone.name || id));
  if (!baseline) return NextResponse.json({ error: 'Baseline not found' }, { status: 404 });

  const baselineIds = baseline.items.map((i) => i.workItemId).filter(Boolean);
  let visibleItems = baseline.items;
  if (baselineIds.length) {
    const objectIds = baselineIds.filter(ObjectId.isValid).map((v) => new ObjectId(v));
    const docs = await db.collection('workitems')
      .find({ $or: [{ _id: { $in: objectIds } }, { id: { $in: baselineIds } }, { key: { $in: baselineIds } }] })
      .toArray();
    const visibleDocs = await visibility.filterVisibleWorkItems(docs as any[]);
    const allowedIds = new Set<string>();
    visibleDocs.forEach((doc: any) => {
      if (doc?._id) allowedIds.add(String(doc._id));
      if (doc?.id) allowedIds.add(String(doc.id));
      if (doc?.key) allowedIds.add(String(doc.key));
    });
    visibleItems = baseline.items.filter((item) => allowedIds.has(item.workItemId) || (item.key && allowedIds.has(item.key)));
  }

  return NextResponse.json({
    baseline: {
      ...baseline,
      items: visibleItems
    }
  });
}
