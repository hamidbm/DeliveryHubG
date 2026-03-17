import { NextResponse } from 'next/server';
import { getDefaultDemoScenario } from '../../../../../services/sampleScenarioService';
import { runSampleBootstrap } from '../../../../../shared/bootstrap/seed';
import { requireAdmin } from '../../../../../shared/auth/guards';

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
    const body = await request.json().catch(() => ({}));
    const collections = Array.isArray(body?.collections) && body.collections.length ? body.collections.map(String) : undefined;
    const scenario = body?.scenario || getDefaultDemoScenario();
    const result = await runSampleBootstrap(auth.principal.userId || 'admin', collections, scenario);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to install sample data' }, { status: 500 });
  }
}
