
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { fetchArchitectureDiagramById, fetchArchitectureDiagrams, fetchArchitectureDiagramsWithReviewSummary, emitEvent, saveArchitectureDiagram } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = {
    bundleId: searchParams.get('bundleId'),
    applicationId: searchParams.get('applicationId'),
  };
  const includeReviewSummary = searchParams.get('includeReviewSummary') === 'true';
  const diagrams = includeReviewSummary
    ? await fetchArchitectureDiagramsWithReviewSummary(filters)
    : await fetchArchitectureDiagrams(filters);
  return NextResponse.json(diagrams);
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const diagramData = await request.json();
    const isCreate = !diagramData?._id || !String(diagramData._id).trim();
    const existing = !isCreate ? await fetchArchitectureDiagramById(String(diagramData._id)) : null;
    if (isCreate && !diagramData?.documentTypeId) {
      return NextResponse.json({ error: 'documentTypeId is required.' }, { status: 400 });
    }
    const normalizeContent = (value: any) => String(value ?? '').replace(/\s+/g, ' ').trim();
    const computeHash = (value: any) => createHash('sha256').update(normalizeContent(value)).digest('hex');
    const contentProvided = Object.prototype.hasOwnProperty.call(diagramData || {}, 'content');
    const oldContentHash = existing?.contentHash || computeHash(existing?.content);
    const newContentHash = contentProvided ? computeHash(diagramData?.content) : oldContentHash;
    const contentChanged = !isCreate && contentProvided && newContentHash !== oldContentHash;
    if (isCreate || contentProvided) {
      diagramData.contentHash = newContentHash;
    }

    const result = await saveArchitectureDiagram(diagramData, payload);

    const actor = {
      userId: String(payload.id || payload.userId || ''),
      displayName: String(payload.name || 'Unknown'),
      email: payload.email ? String(payload.email) : undefined
    };
    const insertedId = (result && typeof (result as any).insertedId !== 'undefined')
      ? (result as any).insertedId
      : undefined;
    const diagramId = isCreate
      ? String(insertedId || diagramData?._id || '')
      : String(diagramData?._id || '');
    const title = String(diagramData?.title || existing?.title || 'Diagram');
    const context = {
      bundleId: diagramData?.bundleId ?? existing?.bundleId,
      appId: diagramData?.applicationId ?? existing?.applicationId,
      milestoneId: diagramData?.milestoneId ?? existing?.milestoneId,
      documentTypeId: diagramData?.documentTypeId ?? existing?.documentTypeId
    };

    if (diagramId) {
      if (isCreate) {
        const type = diagramData?.createdFromUpload ? 'architecture.diagram.uploaded' : 'architecture.diagram.created';
        await emitEvent({
          ts: new Date().toISOString(),
          type,
          actor,
          resource: { type: 'diagram', id: diagramId, title },
          context,
          payload: {
            createdFromTemplate: !!diagramData?.createdFromTemplate,
            createdFromUpload: !!diagramData?.createdFromUpload,
            sourceTemplateId: diagramData?.sourceTemplateId
          }
        });
      } else {
        const emitFieldChange = async (field: string, from: any, to: any) => {
          if (from === to) return;
          await emitEvent({
            ts: new Date().toISOString(),
            type: `architecture.diagram.${field}_changed`,
            actor,
            resource: { type: 'diagram', id: diagramId, title },
            context,
            payload: { field, from, to }
          });
        };

        if (Object.prototype.hasOwnProperty.call(diagramData, 'documentTypeId')) {
          await emitFieldChange('document_type', existing?.documentTypeId, diagramData?.documentTypeId);
        }
        if (Object.prototype.hasOwnProperty.call(diagramData, 'bundleId')) {
          await emitFieldChange('bundle', existing?.bundleId, diagramData?.bundleId);
        }
        if (Object.prototype.hasOwnProperty.call(diagramData, 'applicationId')) {
          await emitFieldChange('application', existing?.applicationId, diagramData?.applicationId);
        }
        if (Object.prototype.hasOwnProperty.call(diagramData, 'milestoneId')) {
          await emitFieldChange('milestone', existing?.milestoneId, diagramData?.milestoneId);
        }

        if (contentChanged) {
          await emitEvent({
            ts: new Date().toISOString(),
            type: 'architecture.diagram.updated',
            actor,
            resource: { type: 'diagram', id: diagramId, title },
            context,
            payload: { contentHash: newContentHash }
          });
        }
      }
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save diagram' }, { status: 500 });
  }
}
