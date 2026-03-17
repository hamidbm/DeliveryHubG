import { NextResponse } from 'next/server';
import { hasAdminRecord } from '../../../../server/db/repositories/adminsRepo';
import { requireUser } from '../../../../shared/auth/guards';

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return NextResponse.json({ isAdmin: false, isCmo: false }, { status: 401 });
    const { principal } = auth;
    const allowed = await hasAdminRecord(principal.userId);
    const roleName = String(principal.role || '');
    const isCmo = Boolean(roleName && roleName.toLowerCase().includes('cmo'));
    return NextResponse.json({ isAdmin: allowed, isCmo, isGuest: principal.accountType === 'GUEST' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Admin check failed' }, { status: 500 });
  }
}
