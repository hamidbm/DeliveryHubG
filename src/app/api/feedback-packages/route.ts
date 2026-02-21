import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { createFeedbackPackage, emitEvent, fetchFeedbackPackages } from '../../../services/db';
import { canCloseCycle, canSubmitForReview } from '../../../services/authz';

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

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');
    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'resourceType and resourceId are required' }, { status: 400 });
    }
    const data = await fetchFeedbackPackages(resourceType, resourceId);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch feedback packages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const body = await request.json();
    const resourceType = String(body.resourceType || '');
    const resourceId = String(body.resourceId || '');
    const resourceTitle = body.resourceTitle ? String(body.resourceTitle) : undefined;
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const summary = body.summary ? String(body.summary) : undefined;
    const effectiveAt = body.effectiveAt ? String(body.effectiveAt) : undefined;

    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'resourceType and resourceId are required' }, { status: 400 });
    }

    const canImport = canSubmitForReview(user) || (await canCloseCycle(user));
    if (!canImport) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const pkg = {
      resource: { type: resourceType, id: resourceId, title: resourceTitle },
      createdAt: new Date().toISOString(),
      importedBy: user,
      source: 'historical_import' as const,
      effectiveAt,
      summary,
      attachments,
      status: 'feedback_sent' as const
    };

    const result = await createFeedbackPackage(pkg);
    await emitEvent({
      ts: new Date().toISOString(),
      type: 'feedback.package.imported',
      actor: user,
      resource: { type: resourceType, id: resourceId, title: resourceTitle },
      payload: { feedbackPackageId: String(result.insertedId) },
      correlationId: String(result.insertedId)
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to import feedback package' }, { status: 500 });
  }
}
