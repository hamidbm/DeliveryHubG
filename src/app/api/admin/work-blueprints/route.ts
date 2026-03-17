import { NextResponse } from 'next/server';
import { listWorkBlueprints, updateWorkBlueprintByKey } from '../../../../server/db/repositories/workAutomationRepo';
import { requireAdmin } from '../../../../shared/auth/guards';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const items = await listWorkBlueprints();
  return NextResponse.json(items);
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const key = String(body.key || '');
  if (!key) return NextResponse.json({ error: 'Key required' }, { status: 400 });
  await updateWorkBlueprintByKey(key, {
    enabled: body.enabled,
    isDefault: body.isDefault
  });
  return NextResponse.json({ success: true });
}
