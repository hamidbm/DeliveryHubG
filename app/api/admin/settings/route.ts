
import { NextResponse } from 'next/server';
import { fetchSystemSettings, saveSystemSettings } from '../../../../services/db';

export async function GET() {
  const settings = await fetchSystemSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  try {
    const settings = await request.json();
    await saveSystemSettings(settings);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update system settings' }, { status: 500 });
  }
}
