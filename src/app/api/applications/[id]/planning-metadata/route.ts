import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import {
  buildPlanningContextPayload,
  buildResolvedPlanningMetadata,
  fetchApplicationById,
  getApplicationPlanningMetadata,
  getBundlePlanningMetadata,
  normalizePlanningMetadata,
  upsertPlanningMetadata
} from '../../../../../services/applicationPlanningMetadata';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { id } = await params;
    const app = await fetchApplicationById(id);
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const appId = String(app._id || app.id || app.aid || id);
    const bundleId = app.bundleId ? String(app.bundleId) : null;
    const bundleMetadata = bundleId ? await getBundlePlanningMetadata(bundleId) : null;
    const appMetadata = await getApplicationPlanningMetadata(appId);

    const normalizedBundle = bundleId
      ? normalizePlanningMetadata(bundleMetadata || {}, 'bundle', bundleId, bundleId, null)
      : null;
    const normalizedApp = normalizePlanningMetadata(appMetadata || {}, 'application', appId, bundleId, appId);
    const resolved = buildResolvedPlanningMetadata(normalizedBundle, normalizedApp, appId, bundleId);

    return NextResponse.json({
      applicationId: appId,
      bundleId,
      planningMetadata: resolved,
      ...buildPlanningContextPayload(normalizedBundle, normalizedApp, resolved)
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load planning metadata' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { id } = await params;
    const app = await fetchApplicationById(id);
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const body = await request.json();
    const incoming = body?.planningMetadata || body || {};
    const appId = String(app._id || app.id || app.aid || id);
    const bundleId = app.bundleId ? String(app.bundleId) : null;

    await upsertPlanningMetadata('application', appId, {
      ...incoming,
      scopeType: 'application',
      scopeId: appId,
      applicationId: appId,
      bundleId
    });

    const bundleMetadata = bundleId ? await getBundlePlanningMetadata(bundleId) : null;
    const appMetadata = await getApplicationPlanningMetadata(appId);
    const normalizedBundle = bundleId
      ? normalizePlanningMetadata(bundleMetadata || {}, 'bundle', bundleId, bundleId, null)
      : null;
    const normalizedApp = normalizePlanningMetadata(appMetadata || {}, 'application', appId, bundleId, appId);
    const resolved = buildResolvedPlanningMetadata(normalizedBundle, normalizedApp, appId, bundleId);

    return NextResponse.json({
      applicationId: appId,
      bundleId,
      planningMetadata: resolved,
      ...buildPlanningContextPayload(normalizedBundle, normalizedApp, resolved)
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save planning metadata' }, { status: 500 });
  }
}
