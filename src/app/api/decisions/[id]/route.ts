import { NextResponse } from 'next/server';
import { createVisibilityContext } from '../../../../services/visibility';
import { getDecision } from '../../../../services/decisionLog';
import { requireUser } from '../../../../shared/auth/guards';
import { ObjectId } from 'mongodb';
import { getMilestoneByRef } from '../../../../server/db/repositories/milestonesRepo';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const visibility = createVisibilityContext(auth.principal);

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const decision = await getDecision(id);
  if (!decision) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (decision.scopeType === 'PROGRAM') {
    return NextResponse.json({ decision });
  }

  const bundleId = decision.related?.bundleId;
  if (bundleId && !(await visibility.canViewBundle(String(bundleId)))) {
    return NextResponse.json({ error: 'Forbidden', code: 'BUNDLE_RESTRICTED' }, { status: 403 });
  }
  if (!bundleId && decision.related?.milestoneId) {
    const milestone = await getMilestoneByRef(String(decision.related.milestoneId));
    if (milestone && !(await visibility.canViewBundle(String(milestone.bundleId || '')))) {
      return NextResponse.json({ error: 'Forbidden', code: 'BUNDLE_RESTRICTED' }, { status: 403 });
    }
  }

  return NextResponse.json({ decision });
}
