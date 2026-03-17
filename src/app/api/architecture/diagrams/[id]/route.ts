
import { NextRequest, NextResponse } from 'next/server';
import { emitEvent } from '../../../../../shared/events/emitEvent';
import { deleteArchitectureDiagramRecord, getArchitectureDiagramById } from '../../../../../server/db/repositories/architectureRepo';
import { requireStandardUser } from '../../../../../shared/auth/guards';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;

    const diagram = await getArchitectureDiagramById(id);
    await deleteArchitectureDiagramRecord(id);

    if (diagram?._id) {
      await emitEvent({
        ts: new Date().toISOString(),
        type: 'architecture.diagram.deleted',
        actor: {
          userId: auth.principal.userId,
          displayName: auth.principal.fullName || 'Unknown',
          email: auth.principal.email
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
