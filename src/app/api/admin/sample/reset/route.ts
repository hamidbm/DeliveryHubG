import { NextResponse } from 'next/server';
import { resetSampleData } from '../../../../../shared/bootstrap/seed';
import { requireAdmin } from '../../../../../shared/auth/guards';

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const body = await request.json().catch(() => ({}));
    await resetSampleData(auth.principal.userId || 'admin', body?.demoTag ? String(body.demoTag) : undefined);
    return NextResponse.json({ success: true, demoTag: body?.demoTag || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to reset sample data' }, { status: 500 });
  }
}
