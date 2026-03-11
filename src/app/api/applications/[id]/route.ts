import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../services/db';
import { getAuthUserFromCookies } from '../../../../services/visibility';

const resolveApp = async (id: string) => {
  const db = await getDb();
  const oid = ObjectId.isValid(id) ? new ObjectId(id) : null;
  return await db.collection('applications').findOne({
    $or: [
      oid ? { _id: oid } : null,
      { id },
      { aid: id }
    ].filter(Boolean) as any[]
  });
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { id } = await params;
  const app = await resolveApp(id);
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  return NextResponse.json(app);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const app = await resolveApp(id);
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const allowedKeys = new Set([
      'name',
      'description',
      'portfolioId',
      'businessOwner',
      'technicalOwner',
      'vendorOwner',
      'tier',
      'lifecycleStatus',
      'businessCriticality',
      'availabilityTier',
      'dataSensitivity',
      'regulatoryImpact',
      'operationalOwner',
      'releaseTrain',
      'isActive',
      'tags',
      'techStack'
    ]);

    const update: any = { updatedAt: new Date().toISOString() };
    Object.keys(body || {}).forEach((key) => {
      if (allowedKeys.has(key)) update[key] = (body as any)[key];
    });

    if (typeof update.name === 'string') update.name = update.name.trim();
    if (update.name === '') return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const db = await getDb();
    await db.collection('applications').updateOne({ _id: app._id }, { $set: update });
    const next = await db.collection('applications').findOne({ _id: app._id });
    return NextResponse.json(next);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update application' }, { status: 400 });
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return PUT(request, ctx);
}
