import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { isAdmin } from '../../../../../../services/db';
import { DemoScenario } from '../../../../../../types/demoScenario';
import { DemoScenarioValidationError, installDemoScenario } from '../../../../../../services/sampleScenarioService';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUser = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    email: payload.email ? String(payload.email) : undefined
  };
};

const requireAdmin = async () => {
  const user = await getUser();
  if (!user?.userId) return { ok: false, status: 401 as const, user: null };
  const allowed = await isAdmin(user.userId);
  if (!allowed) return { ok: false, status: 403 as const, user };
  return { ok: true, status: 200 as const, user };
};

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const scenario = body?.scenario as DemoScenario;
    const result = await installDemoScenario(scenario, { userId: auth.user!.userId, email: auth.user!.email });
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    if (error instanceof DemoScenarioValidationError) {
      return NextResponse.json({ success: false, error: error.message, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error?.message || 'Failed to install sample scenario' }, { status: 500 });
  }
}
