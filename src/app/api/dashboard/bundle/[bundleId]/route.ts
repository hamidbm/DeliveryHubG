import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { getBundleDashboard } from '../../../../../services/dashboardService';
import { DashboardFilters } from '../../../../../types/dashboard';

const parseFilters = (request: Request): DashboardFilters => {
  const { searchParams } = new URL(request.url);
  return {
    applicationId: searchParams.get('applicationId') || undefined,
    teamId: searchParams.get('teamId') || undefined,
    environment: searchParams.get('environment') || undefined,
    quickFilter: searchParams.get('quickFilter') || undefined,
    timeWindow: (searchParams.get('timeWindow') as DashboardFilters['timeWindow']) || '30d',
    compareTo: (searchParams.get('compareTo') as DashboardFilters['compareTo']) || undefined,
    viewMode: (searchParams.get('viewMode') as DashboardFilters['viewMode']) || 'executive'
  };
};

export async function GET(request: Request, context: { params: Promise<{ bundleId: string }> }) {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  try {
    const { bundleId } = await context.params;
    const filters = parseFilters(request);
    const data = await getBundleDashboard(bundleId, filters);
    return NextResponse.json({ status: 'success', data });
  } catch {
    return NextResponse.json({ status: 'error', error: 'Unable to load bundle dashboard.' }, { status: 500 });
  }
}
