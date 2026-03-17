import { NextResponse } from 'next/server';
import { emitEvent } from '../../../shared/events/emitEvent';
import { listFeedbackPackages, saveFeedbackPackageRecord } from '../../../server/db/repositories/feedbackPackagesRepo';
import { canCloseCycle, canSubmitForReview } from '../../../services/authz';
import { requireStandardUser, requireUser } from '../../../shared/auth/guards';

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');
    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'resourceType and resourceId are required' }, { status: 400 });
    }
    const data = await listFeedbackPackages(resourceType, resourceId);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch feedback packages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      displayName: auth.principal.fullName || 'Unknown',
      email: auth.principal.email,
      role: auth.principal.role || undefined,
      accountType: auth.principal.accountType
    };
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

    const result = await saveFeedbackPackageRecord(pkg);
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
