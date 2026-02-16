
import { NextResponse } from 'next/server';
import { fetchCapabilities, saveCapability } from '../../../services/db';

export async function GET() {
  const capabilities = await fetchCapabilities();
  return NextResponse.json(capabilities);
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const result = await saveCapability(data);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save capability' }, { status: 500 });
  }
}
