import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../../shared/events/emitEvent';
import { fetchWorkItemById } from '../../../../../services/workItemsService';
import { invalidateWorkItemScopesFromCandidates } from '../../../../../services/workItemCache';
import { requireStandardUser } from '../../../../../shared/auth/guards';
import { restoreWorkItemRecord } from '../../../../../server/db/repositories/workItemsRepo';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const payload = auth.principal.rawPayload;
    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const userName = String(auth.principal.fullName || payload.name || '');
    const userRole = String(auth.principal.role || (payload as any).role || '');
    const privilegedRoles = new Set([
      'CMO Architect',
      'SVP Architect',
      'SVP PM',
      'SVP Engineer',
      'Director',
      'VP',
      'CIO'
    ]);
    const isOwner = userName && (item.assignedTo === userName || item.createdBy === userName);
    if (!isOwner && !privilegedRoles.has(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { now } = await restoreWorkItemRecord(id);
    await invalidateWorkItemScopesFromCandidates(
      [{ bundleId: item?.bundleId, applicationId: item?.applicationId }],
      'workitems.restore'
    );

    try {
      await emitEvent({
        ts: now,
        type: 'workitems.item.restored',
        actor: {
          userId: auth.principal.userId || String((payload as any).id || (payload as any).userId || (payload as any).email || userName),
          displayName: auth.principal.fullName || String((payload as any).name || (payload as any).displayName || userName),
          email: auth.principal.email || ((payload as any).email ? String((payload as any).email) : undefined)
        },
        resource: { type: 'workitems.item', id: String(item._id || item.id || id), title: item.title },
        context: { bundleId: item.bundleId, appId: item.applicationId }
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Restore failed' }, { status: 500 });
  }
}
