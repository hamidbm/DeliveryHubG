import { NextResponse } from 'next/server';
import { deleteDiagramTemplate, fetchDiagramTemplateById, saveDiagramTemplate, isAdmin } from '../../../../services/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { Role } from '../../../../types';

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await fetchDiagramTemplateById(id);
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(template);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const allowed = await canManageDiagramTemplates(user);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const result = await saveDiagramTemplate({ ...body, _id: id }, { name: user.name });
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const allowed = await canManageDiagramTemplates(user);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const result = await deleteDiagramTemplate(id);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Delete failed' }, { status: 500 });
  }
}
