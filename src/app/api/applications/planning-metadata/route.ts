import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import {
  getBundlePlanningMetadata,
  getPlanningMetadataByScope,
  normalizePlanningMetadata,
  upsertPlanningMetadata
} from '../../../../services/applicationPlanningMetadata';

export async function GET(request: Request) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const scopeType = (searchParams.get('scopeType') || '') as 'bundle' | 'application';
    const scopeId = searchParams.get('scopeId') || '';

    if (!scopeType || !scopeId) {
      return NextResponse.json({ error: 'scopeType and scopeId are required' }, { status: 400 });
    }

    const record = scopeType === 'bundle'
      ? await getBundlePlanningMetadata(scopeId)
      : await getPlanningMetadataByScope('application', scopeId);

    const normalized = normalizePlanningMetadata(record || {}, scopeType, scopeId, scopeType === 'bundle' ? scopeId : record?.bundleId || null, scopeType === 'application' ? scopeId : null);
    return NextResponse.json({ planningMetadata: normalized });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load planning metadata' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const body = await request.json();
    const scopeType = body?.scopeType as 'bundle' | 'application';
    const scopeId = body?.scopeId as string;

    if (!scopeType || !scopeId) {
      return NextResponse.json({ error: 'scopeType and scopeId are required' }, { status: 400 });
    }

    await upsertPlanningMetadata(scopeType, scopeId, {
      ...body,
      scopeType,
      scopeId
    });

    const record = await getPlanningMetadataByScope(scopeType, scopeId);
    const normalized = normalizePlanningMetadata(record || {}, scopeType, scopeId, body?.bundleId || (scopeType === 'bundle' ? scopeId : null), body?.applicationId || (scopeType === 'application' ? scopeId : null));
    return NextResponse.json({ planningMetadata: normalized });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save planning metadata' }, { status: 500 });
  }
}
