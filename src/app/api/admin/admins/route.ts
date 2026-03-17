import { NextResponse } from 'next/server';
import { listAdmins, saveAdminRecord } from '../../../../server/db/repositories/adminsRepo';
import { fetchUsersByIds } from '../../../../services/userDirectory';
import { requireAdmin } from '../../../../shared/auth/guards';

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
    const admins = await listAdmins();
    const userIds = admins.map((a: any) => String(a.userId));
    const users = await fetchUsersByIds(userIds);
    const userMap = new Map(users.map((u: any) => [String(u._id || u.id), u]));
    const payload = admins.map((a: any) => ({
      ...a,
      user: userMap.get(String(a.userId)) || null
    }));
    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch admins' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
    const body = await request.json();
    if (!body?.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const result = await saveAdminRecord(String(body.userId), auth.principal.userId || 'system');
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to add admin' }, { status: 500 });
  }
}
