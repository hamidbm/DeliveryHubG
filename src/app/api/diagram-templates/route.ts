import { NextResponse } from 'next/server';
import { fetchDiagramTemplates, saveDiagramTemplate, isAdmin } from '../../../services/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { Role } from '../../../types';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUser = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    name: String(payload.name || payload.username || 'Unknown'),
    role: payload.role ? String(payload.role) : undefined
  };
};

const canManageDiagramTemplates = async (user?: { userId?: string; role?: string }) => {
  if (!user?.userId) return false;
  if (user.role === Role.CMO_MEMBER) return true;
  return await isAdmin(user.userId);
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const diagramType = searchParams.get('diagramType') || undefined;
  const format = searchParams.get('format') || undefined;
  const includeContent = searchParams.get('includeContent') === 'true';
  const includeInactive = searchParams.get('includeInactive') === 'true';

  const templates = await fetchDiagramTemplates({ diagramType, format, includeInactive });
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
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const allowed = await canManageDiagramTemplates(user);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    if (!body?.key || !body?.name || !body?.diagramType || !body?.format || !body?.content) {
      return NextResponse.json({ error: 'key, name, diagramType, format, content required' }, { status: 400 });
    }
    const result = await saveDiagramTemplate(body, { name: user.name });
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Create failed' }, { status: 500 });
  }
}
