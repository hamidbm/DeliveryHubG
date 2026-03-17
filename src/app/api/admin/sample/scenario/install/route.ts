import { NextResponse } from 'next/server';
import { DemoScenario } from '../../../../../../types/demoScenario';
import { DemoScenarioValidationError, installDemoScenario } from '../../../../../../services/sampleScenarioService';
import { requireAdmin } from '../../../../../../shared/auth/guards';

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const scenario = body?.scenario as DemoScenario;
    const result = await installDemoScenario(scenario, { userId: auth.principal.userId, email: auth.principal.email });
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    if (error instanceof DemoScenarioValidationError) {
      return NextResponse.json({ success: false, error: error.message, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error?.message || 'Failed to install sample scenario' }, { status: 500 });
  }
}
