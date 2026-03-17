
import { NextResponse } from 'next/server';
import { listApplications, saveApplicationRecord } from '../../../server/db/repositories/applicationsRepo';
import { requireStandardUser } from '../../../shared/auth/guards';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bundleId = searchParams.get('bundleId') || undefined;
  const activeOnly = searchParams.get('active') === 'true';
  const apps = await listApplications(bundleId, activeOnly);
  return NextResponse.json(apps);
}

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const appData = await request.json();
    const result = await saveApplicationRecord(appData);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save application' }, { status: 500 });
  }
}
