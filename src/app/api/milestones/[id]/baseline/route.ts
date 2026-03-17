import { NextResponse } from 'next/server';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../../services/visibility';
import { getMilestoneBaseline } from '../../../../../services/baselineDelta';
import { getMilestoneByRef } from '../../../../../server/db/repositories/milestonesRepo';
import { listWorkItemsByAnyRefs } from '../../../../../server/db/repositories/workItemsRepo';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const visibility = createVisibilityContext(authUser);

  const milestone = await getMilestoneByRef(id);
  if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await visibility.canViewBundle(String(milestone.bundleId || '')))) {
    return NextResponse.json({ error: 'Forbidden', code: 'BUNDLE_RESTRICTED' }, { status: 403 });
  }

  const baseline = await getMilestoneBaseline(String(milestone._id || milestone.id || milestone.name || id));
  if (!baseline) return NextResponse.json({ error: 'Baseline not found' }, { status: 404 });

  const baselineIds = baseline.items.map((i) => i.workItemId).filter(Boolean);
  let visibleItems = baseline.items;
  if (baselineIds.length) {
    const docs = await listWorkItemsByAnyRefs(baselineIds);
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
