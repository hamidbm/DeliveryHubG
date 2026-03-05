import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../services/db';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../services/visibility';
import { getDecision } from '../../../../services/decisionLog';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const visibility = createVisibilityContext(authUser);

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const decision = await getDecision(id);
  if (!decision) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (decision.scopeType === 'PROGRAM') {
    return NextResponse.json({ decision });
  }

  const db = await getDb();
  const bundleId = decision.related?.bundleId;
  if (bundleId && !(await visibility.canViewBundle(String(bundleId)))) {
    return NextResponse.json({ error: 'Forbidden', code: 'BUNDLE_RESTRICTED' }, { status: 403 });
  }
  if (!bundleId && decision.related?.milestoneId) {
    const milestone = await db.collection('milestones').findOne({ _id: new ObjectId(decision.related.milestoneId) });
    if (milestone && !(await visibility.canViewBundle(String(milestone.bundleId || '')))) {
      return NextResponse.json({ error: 'Forbidden', code: 'BUNDLE_RESTRICTED' }, { status: 403 });
    }
  }

  return NextResponse.json({ decision });
}
