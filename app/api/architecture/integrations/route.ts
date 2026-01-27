
import { NextResponse } from 'next/server';
import { fetchInterfaces, saveInterface } from '../../../../services/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get('applicationId') || undefined;
  const interfaces = await fetchInterfaces(appId);
  return NextResponse.json(interfaces);
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const result = await saveInterface(data);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 });
  }
}
