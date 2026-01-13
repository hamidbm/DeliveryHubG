
import { NextResponse } from 'next/server';
import { fetchApplications, saveApplication } from '../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { Role } from '../../../types';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bundleId = searchParams.get('bundleId') || undefined;
  const activeOnly = searchParams.get('active') === 'true';
  const apps = await fetchApplications(bundleId, activeOnly);
  return NextResponse.json(apps);
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    // TEMPORARY: Suspended role check for implementation phase
    /*
    if (payload.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Unauthorized: Admin role required' }, { status: 403 });
    }
    */

    const appData = await request.json();
    const result = await saveApplication(appData, payload);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save application' }, { status: 500 });
  }
}
