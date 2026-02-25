import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { createWorkPlanFromIntake, getDb } from '../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);

    const body = await request.json();
    const scopeType = String(body.scopeType || '');
    const scopeId = String(body.scopeId || '');
    if (!['bundle', 'application'].includes(scopeType) || !scopeId) {
      return NextResponse.json({ error: 'scopeType and scopeId are required.' }, { status: 400 });
    }

    const goLiveDate = body.goLiveDate ? String(body.goLiveDate) : undefined;
    const devStartDate = body.devStartDate ? String(body.devStartDate) : undefined;
    const uatStartDate = body.uatStartDate ? String(body.uatStartDate) : undefined;
    const uatEndDate = body.uatEndDate ? String(body.uatEndDate) : undefined;
    const milestoneCount = Number(body.milestoneCount || 4);
    const milestoneDurationWeeks = Number(body.milestoneDurationWeeks || 3);
    const sprintDurationWeeks = Number(body.sprintDurationWeeks || 2);
    const milestoneThemes = Array.isArray(body.milestoneThemes) ? body.milestoneThemes : [];

    await getDb(); // ensure connection
    await createWorkPlanFromIntake({
      scopeType: scopeType as any,
      scopeId,
      goLiveDate,
      devStartDate,
      uatStartDate,
      uatEndDate,
      milestoneCount,
      milestoneDurationWeeks,
      sprintDurationWeeks,
      milestoneThemes,
      actor: payload as any
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create plan' }, { status: 500 });
  }
}
