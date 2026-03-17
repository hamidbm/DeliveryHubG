
import { NextResponse } from 'next/server';
import { listCapabilities, saveCapabilityRecord } from '../../../server/db/repositories/architectureRepo';
import { requireStandardUser, requireUser } from '../../../shared/auth/guards';

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const capabilities = await listCapabilities();
  return NextResponse.json(capabilities);
}

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const data = await request.json();
    const result = await saveCapabilityRecord(data);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save capability' }, { status: 500 });
  }
}
