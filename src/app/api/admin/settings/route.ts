
import { NextResponse } from 'next/server';
import { fetchSystemSettings, saveSystemSettings } from '../../../../services/aiSettings';
import { requireAdmin } from '../../../../shared/auth/guards';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const settings = await fetchSystemSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
    const settings = await request.json();
    await saveSystemSettings(settings);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update system settings' }, { status: 500 });
  }
}
