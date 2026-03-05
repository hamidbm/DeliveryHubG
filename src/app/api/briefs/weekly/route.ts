import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../services/db';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../services/visibility';
import { fetchWeeklyBrief, generateBundleBrief, generateMilestoneBrief, generateProgramBrief, resolveWeekKey, upsertWeeklyBrief, queueWeeklyBriefDigest } from '../../../../services/weeklyBrief';

export async function GET(request: Request) {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const visibility = createVisibilityContext(authUser);

  const { searchParams } = new URL(request.url);
  const scopeType = String(searchParams.get('scopeType') || 'PROGRAM').toUpperCase();
  const rawScopeId = searchParams.get('scopeId') ? String(searchParams.get('scopeId')) : undefined;
  const scopeId = scopeType === 'PROGRAM' ? 'program' : rawScopeId;
  const weekKey = resolveWeekKey(searchParams.get('weekKey') || undefined);
  const force = searchParams.get('force') === 'true';

  const db = await getDb();
  if (scopeType === 'BUNDLE' && scopeId) {
    const bundleQuery = ObjectId.isValid(scopeId)
      ? { $or: [{ _id: new ObjectId(scopeId) }, { id: scopeId }, { name: scopeId }] }
      : { $or: [{ id: scopeId }, { name: scopeId }] };
    const bundle = await db.collection('bundles').findOne(bundleQuery);
    if (!bundle) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!(await visibility.canViewBundle(String(bundle._id || bundle.id || scopeId)))) {
      return NextResponse.json({ error: 'Forbidden', code: 'BUNDLE_RESTRICTED' }, { status: 403 });
    }
  }
  if (scopeType === 'MILESTONE' && scopeId) {
    const milestoneQuery = ObjectId.isValid(scopeId)
      ? { $or: [{ _id: new ObjectId(scopeId) }, { id: scopeId }, { name: scopeId }] }
      : { $or: [{ id: scopeId }, { name: scopeId }] };
    const milestone = await db.collection('milestones').findOne(milestoneQuery);
    if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!(await visibility.canViewBundle(String(milestone.bundleId || '')))) {
      return NextResponse.json({ error: 'Forbidden', code: 'BUNDLE_RESTRICTED' }, { status: 403 });
    }
  }

  const existing = await fetchWeeklyBrief(scopeType as any, scopeId, weekKey);
  if (existing && !force) {
    return NextResponse.json({ brief: existing, cached: true });
  }

  let brief = null;
  if (scopeType === 'PROGRAM') {
    brief = await generateProgramBrief(weekKey, { userId: authUser.userId, visibility });
  } else if (scopeType === 'BUNDLE' && scopeId) {
    brief = await generateBundleBrief(scopeId, weekKey, { userId: authUser.userId, visibility });
  } else if (scopeType === 'MILESTONE' && scopeId) {
    brief = await generateMilestoneBrief(scopeId, weekKey, { userId: authUser.userId, visibility });
  }

  if (!brief) return NextResponse.json({ error: 'Unable to generate brief' }, { status: 500 });
  const stored = await upsertWeeklyBrief(brief, force);
  await queueWeeklyBriefDigest(stored);
  return NextResponse.json({ brief: stored, cached: false });
}
