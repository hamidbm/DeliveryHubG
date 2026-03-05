import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../services/db';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../../services/visibility';

const parseList = (value: string | null) =>
  value ? value.split(',').map((v) => v.trim()).filter(Boolean) : [];

export async function GET(request: Request) {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const visibility = createVisibilityContext(authUser);

  const { searchParams } = new URL(request.url);
  const milestoneIds = parseList(searchParams.get('milestoneIds'));
  if (!milestoneIds.length) return NextResponse.json({ items: [] });

  const db = await getDb();
  const objectIds = milestoneIds.filter(ObjectId.isValid).map((id) => new ObjectId(id));
  const milestones = await db.collection('milestones').find({
    $or: [
      { _id: { $in: objectIds } },
      { id: { $in: milestoneIds } },
      { name: { $in: milestoneIds } }
    ]
  }).toArray();

  const visibleMilestones = [];
  for (const milestone of milestones) {
    const bundleId = String(milestone.bundleId || '');
    const canView = await visibility.canViewBundle(bundleId);
    if (canView) visibleMilestones.push(milestone);
  }

  const allowedIds = visibleMilestones.map((m: any) => String(m._id || m.id || m.name || '')).filter(Boolean);
  if (!allowedIds.length) return NextResponse.json({ items: [] });

  const snapshots = await db.collection('commitment_drift_snapshots')
    .find({ milestoneId: { $in: allowedIds } })
    .toArray();

  const items = snapshots.map((s: any) => ({
    milestoneId: s.milestoneId,
    evaluatedAt: s.evaluatedAt,
    driftBand: s.driftBand,
    deltas: s.deltas || [],
    baselineAt: s.baselineAt || null,
    hasBaseline: s.hasBaseline !== false
  }));

  return NextResponse.json({ items });
}
