import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { closeFeedbackPackage, emitEvent } from '../../../../../services/db';
import { canCloseCycle } from '../../../../../services/authz';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUser = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    displayName: String(payload.name || 'Unknown'),
    email: payload.email ? String(payload.email) : undefined,
    role: payload.role ? String(payload.role) : undefined
  };
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    if (!(await canCloseCycle(user))) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const resourceType = body.resourceType ? String(body.resourceType) : undefined;
    const resourceId = body.resourceId ? String(body.resourceId) : undefined;
    const resourceTitle = body.resourceTitle ? String(body.resourceTitle) : undefined;

    await closeFeedbackPackage(id, user.userId);

    if (resourceType && resourceId) {
      await emitEvent({
        ts: new Date().toISOString(),
        type: 'feedback.package.closed',
        actor: user,
        resource: { type: resourceType, id: resourceId, title: resourceTitle },
        payload: { feedbackPackageId: id },
        correlationId: id
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to close feedback package' }, { status: 500 });
  }
}
