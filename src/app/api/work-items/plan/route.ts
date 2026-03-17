import { NextResponse } from 'next/server';
import { createWorkPlanFromIntake } from '../../../../services/workItemsService';
import { requireStandardUser } from '../../../../shared/auth/guards';

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;

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
      actor: auth.principal.rawPayload as any
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create plan' }, { status: 500 });
  }
}
