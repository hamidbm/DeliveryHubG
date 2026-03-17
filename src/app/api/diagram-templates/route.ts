import { NextResponse } from 'next/server';
import { hasAdminRecord } from '../../../server/db/repositories/adminsRepo';
import { listDiagramTemplates, saveDiagramTemplateRecord } from '../../../server/db/repositories/architectureRepo';
import { Role } from '../../../types';
import { requireStandardUser, requireUser } from '../../../shared/auth/guards';

const canManageDiagramTemplates = async (user?: { userId?: string; role?: string }) => {
  if (!user?.userId) return false;
  if (user.role === Role.CMO_MEMBER) return true;
  return await hasAdminRecord(user.userId);
};

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const diagramType = searchParams.get('diagramType') || undefined;
  const format = searchParams.get('format') || undefined;
  const includeContent = searchParams.get('includeContent') === 'true';
  const includeInactive = searchParams.get('includeInactive') === 'true';

  const templates = await listDiagramTemplates({ diagramType, format, includeInactive });
  if (includeContent) return NextResponse.json(templates);

  const slim = templates.map((t: any) => ({
    _id: t._id,
    name: t.name,
    description: t.description,
    diagramType: t.diagramType,
    format: t.format,
    preview: t.preview,
    tags: t.tags
  }));
  return NextResponse.json(slim);
}

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      name: auth.principal.fullName || auth.principal.username || 'Unknown',
      role: auth.principal.role || undefined
    };
    const allowed = await canManageDiagramTemplates(user);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    if (!body?.key || !body?.name || !body?.diagramType || !body?.format || !body?.content) {
      return NextResponse.json({ error: 'key, name, diagramType, format, content required' }, { status: 400 });
    }
    const result = await saveDiagramTemplateRecord(body, { name: user.name });
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Create failed' }, { status: 500 });
  }
}
