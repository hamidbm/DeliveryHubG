import { NextResponse } from 'next/server';
import { listWorkGenerators, updateWorkGeneratorByEventType } from '../../../../server/db/repositories/workAutomationRepo';
import { requireAdmin } from '../../../../shared/auth/guards';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const items = await listWorkGenerators();
  return NextResponse.json(items);
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const eventType = String(body.eventType || '');
  if (!eventType) return NextResponse.json({ error: 'eventType required' }, { status: 400 });
  await updateWorkGeneratorByEventType(eventType, { enabled: body.enabled });
  return NextResponse.json({ success: true });
}
