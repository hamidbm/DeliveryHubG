import { NextResponse } from 'next/server';
import { findApplicationByAnyId, updateApplicationById } from '../../../../server/db/repositories/applicationsRepo';
import { requireStandardUser, requireUser } from '../../../../shared/auth/guards';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const app = await findApplicationByAnyId(id);
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  return NextResponse.json(app);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const app = await findApplicationByAnyId(id);
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

    const next = await updateApplicationById(app._id, update);
    return NextResponse.json(next);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update application' }, { status: 400 });
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return PUT(request, ctx);
}
