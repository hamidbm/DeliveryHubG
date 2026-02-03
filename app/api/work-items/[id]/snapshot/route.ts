
import { NextResponse } from 'next/server';
import { fetchWorkItemById, saveWikiPage, getDb } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const item = await fetchWorkItemById(params.id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const db = await getDb();
    const now = new Date().toISOString();

    // Create Audit Content
    const reportContent = `
# Governance Audit Snapshot: ${item.key}
## Artifact: ${item.title}
**Status:** ${item.status} | **Priority:** ${item.priority} | **Assigned To:** ${item.assignedTo}
**Snapshot Date:** ${now}
**Auditor:** ${payload.name}

### Accepting Definition of Done (DoD)
${(item.checklists || []).map(c => `- [${c.isCompleted ? 'x' : ' '}] ${c.label}`).join('\n')}

### Execution History
${(item.activity || []).map(a => `- **${a.createdAt}:** ${a.user} executed ${a.action} on ${a.field || 'artifact'}`).join('\n')}

### Narrative Context
${item.description || 'No description provided.'}
    `;

    // Save to Wiki Registry (Hidden 'audit' space or global)
    await saveWikiPage({
      title: `Audit Report: ${item.key}`,
      content: reportContent,
      slug: `audit-${item.key.toLowerCase()}`,
      spaceId: 'audit_registry',
      bundleId: item.bundleId,
      applicationId: item.applicationId,
      status: 'Published'
    });

    // Mark item as snapshotted in activity
    await db.collection('workitems').updateOne(
      { _id: new ObjectId(params.id) },
      { $push: { activity: { user: 'Nexus Governance', action: 'AUDIT_SNAPSHOT_CREATED', createdAt: now } as any } }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Snapshot failed' }, { status: 500 });
  }
}
