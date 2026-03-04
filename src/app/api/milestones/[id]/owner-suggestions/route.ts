import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../services/db';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../../services/visibility';
import { suggestOwnersForMilestone } from '../../../../../services/ownership';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const db = await getDb();
  const milestone = ObjectId.isValid(id)
    ? await db.collection('milestones').findOne({ _id: new ObjectId(id) })
    : await db.collection('milestones').findOne({ $or: [{ id }, { name: id }] });
  if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const visibility = createVisibilityContext(authUser);
  if (!(await visibility.canViewMilestone(String(milestone._id || milestone.id || milestone.name || id)))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const suggestions = await suggestOwnersForMilestone(String(milestone._id || milestone.id || milestone.name || id));
  return NextResponse.json(suggestions);
}
