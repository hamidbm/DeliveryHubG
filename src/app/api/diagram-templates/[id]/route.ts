import { NextResponse } from 'next/server';
import { hasAdminRecord } from '../../../../server/db/repositories/adminsRepo';
import { deleteDiagramTemplateRecord, getDiagramTemplateById, saveDiagramTemplateRecord } from '../../../../server/db/repositories/architectureRepo';
import { Role } from '../../../../types';
import { requireStandardUser, requireUser } from '../../../../shared/auth/guards';

const canManageDiagramTemplates = async (user?: { userId?: string; role?: string }) => {
  if (!user?.userId) return false;
  if (user.role === Role.CMO_MEMBER) return true;
  return await hasAdminRecord(user.userId);
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const template = await getDiagramTemplateById(id);
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(template);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const { id } = await params;
    const body = await request.json();
    const result = await saveDiagramTemplateRecord({ ...body, _id: id }, { name: user.name });
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const { id } = await params;
    const result = await deleteDiagramTemplateRecord(id);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Delete failed' }, { status: 500 });
  }
}
