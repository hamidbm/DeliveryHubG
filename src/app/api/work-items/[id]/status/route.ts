
import { NextResponse } from 'next/server';
import { updateWorkItemStatus } from '../../../../../services/workItemsService';
import { fetchWorkItemById } from '../../../../../server/db/repositories/workItemsRepo';
import { invalidateWorkItemScopesFromCandidates } from '../../../../../services/workItemCache';
import { requireStandardUser } from '../../../../../shared/auth/guards';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const payload = auth.principal.rawPayload;
    const { toStatus, newRank } = await request.json();

    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const criticalStatuses = new Set(['DONE', 'BLOCKED', 'REVIEW']);
    if (criticalStatuses.has(toStatus)) {
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
    }

    const result = await updateWorkItemStatus(id, toStatus, newRank, payload);
    await invalidateWorkItemScopesFromCandidates(
      [{ bundleId: item?.bundleId, applicationId: item?.applicationId }],
      'workitems.status'
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 });
  }
}
