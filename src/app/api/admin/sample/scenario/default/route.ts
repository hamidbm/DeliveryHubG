import { NextResponse } from 'next/server';
import { getDefaultDemoScenario } from '../../../../../../services/sampleScenarioService';
import { requireAdmin } from '../../../../../../shared/auth/guards';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    return NextResponse.json({ scenario: getDefaultDemoScenario() });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load default sample scenario' }, { status: 500 });
  }
}
