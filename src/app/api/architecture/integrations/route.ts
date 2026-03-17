
import { NextResponse } from 'next/server';
import { listInterfaces, saveInterfaceRecord } from '../../../../server/db/repositories/architectureRepo';
import { requireStandardUser, requireUser } from '../../../../shared/auth/guards';

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get('applicationId') || undefined;
  const interfaces = await listInterfaces(appId);
  return NextResponse.json(interfaces);
}

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const data = await request.json();
    const result = await saveInterfaceRecord(data);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 });
  }
}
