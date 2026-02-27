
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { deleteArchitectureDiagram, emitEvent, fetchArchitectureDiagramById } from '../../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);

    const diagram = await fetchArchitectureDiagramById(id);
    await deleteArchitectureDiagram(id);

    if (diagram?._id) {
      await emitEvent({
        ts: new Date().toISOString(),
        type: 'architecture.diagram.deleted',
        actor: {
          userId: String(payload.id || payload.userId || ''),
          displayName: String(payload.name || 'Unknown'),
          email: payload.email ? String(payload.email) : undefined
        },
        resource: { type: 'diagram', id: String(diagram._id), title: diagram.title },
        context: {
          bundleId: diagram.bundleId,
          appId: diagram.applicationId,
          milestoneId: diagram.milestoneId,
          documentTypeId: diagram.documentTypeId
        }
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
