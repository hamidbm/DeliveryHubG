
import { NextResponse } from 'next/server';
import { saveWikiPageRecord } from '@/server/db/repositories/wikiRepo';
import { fetchWorkItemById } from '@/services/workItemsService';
import { requireStandardUser } from '@/shared/auth/guards';
import { appendWorkItemActivityRecord } from '@/server/db/repositories/workItemsRepo';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const now = new Date().toISOString();

    // Create Audit Content
    const reportContent = `
# Governance Audit Snapshot: ${item.key}
## Artifact: ${item.title}
**Status:** ${item.status} | **Priority:** ${item.priority} | **Assigned To:** ${item.assignedTo}
**Snapshot Date:** ${now}
**Auditor:** ${auth.principal.fullName || auth.principal.email || 'Unknown'}

### Accepting Definition of Done (DoD)
${(item.checklists || []).map(c => `- [${c.isCompleted ? 'x' : ' '}] ${c.label}`).join('\n')}

### Execution History
${(item.activity || []).map(a => `- **${a.createdAt}:** ${a.user} executed ${a.action} on ${a.field || 'artifact'}`).join('\n')}

### Narrative Context
${item.description || 'No description provided.'}
    `;

    // Save to Wiki Registry (Hidden 'audit' space or global)
    await saveWikiPageRecord({
      title: `Audit Report: ${item.key}`,
      content: reportContent,
      slug: `audit-${item.key.toLowerCase()}`,
      spaceId: 'audit_registry',
      bundleId: item.bundleId,
      applicationId: item.applicationId,
      status: 'Published'
    });

    // Mark item as snapshotted in activity
    await appendWorkItemActivityRecord(id, { user: 'DeliveryHub Governance', action: 'AUDIT_SNAPSHOT_CREATED', createdAt: now });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Snapshot failed' }, { status: 500 });
  }
}
