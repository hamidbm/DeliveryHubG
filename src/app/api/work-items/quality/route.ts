import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  try {
    await jwtVerify(token, JWT_SECRET);
    const milestoneId = searchParams.get('milestoneId');
    const sprintId = searchParams.get('sprintId');
    const issue = searchParams.get('issue');
    if (!milestoneId && !sprintId) {
      return NextResponse.json({ error: 'milestoneId or sprintId required' }, { status: 400 });
    }
    if (!issue) {
      return NextResponse.json({ error: 'issue required' }, { status: 400 });
    }

    const db = await getDb();
    const query: any = {
      $and: [
        { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] },
        { status: { $ne: 'DONE' } }
      ]
    };

    if (milestoneId) {
      const msId = String(milestoneId);
      const msObjectIds = ObjectId.isValid(msId) ? [new ObjectId(msId)] : [];
      query.$and.push({
        $or: [
          { milestoneIds: { $in: [msId, ...msObjectIds] } },
          { milestoneId: { $in: [msId, ...msObjectIds] } }
        ]
      });
    }
    if (sprintId) {
      const spId = String(sprintId);
      const spObjectIds = ObjectId.isValid(spId) ? [new ObjectId(spId)] : [];
      query.$and.push({ sprintId: { $in: [spId, ...spObjectIds] } });
    }

    if (issue === 'missingStoryPoints') {
      query.$and.push({ $or: [{ storyPoints: { $exists: false } }, { storyPoints: null }] });
    }
    if (issue === 'missingDueAt') {
      query.$and.push({ $or: [{ dueAt: { $exists: false } }, { dueAt: null }, { dueAt: '' }] });
    }
    if (issue === 'missingRiskSeverity') {
      query.$and.push({ type: 'RISK' });
      query.$and.push({
        $or: [
          { 'risk.severity': { $exists: false } },
          { 'risk.severity': null },
          { 'risk.severity': '' }
        ]
      });
    }

    const items = await db.collection('workitems')
      .find(query)
      .project({ _id: 1, id: 1, key: 1, title: 1, status: 1, storyPoints: 1, dueAt: 1, assignedTo: 1, risk: 1, type: 1 })
      .limit(200)
      .toArray();

    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Quality lookup failed' }, { status: 500 });
  }
}
