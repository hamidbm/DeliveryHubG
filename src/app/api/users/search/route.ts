import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { listAdmins } from '../../../../server/db/repositories/adminsRepo';
import { searchUsersWithFilters } from '../../../../server/db/repositories/usersRepo';
import { requireUser } from '../../../../shared/auth/guards';

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get('q') || '').trim();
    const scope = String(searchParams.get('scope') || 'cmo');

    const roleClauses: any[] = [];
    if (scope === 'cmo') {
      roleClauses.push({ role: { $regex: /CMO/i } });
      roleClauses.push({ team: { $regex: /CMO/i } });
    }

    let adminIds: string[] = [];
    if (searchParams.get('includeAdmin') === 'true') {
      const admins = await listAdmins();
      adminIds = admins.map((a: any) => String(a.userId)).filter(Boolean);
      if (adminIds.length) {
        roleClauses.push({ _id: { $in: adminIds.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } });
      }
    }
    const users = await searchUsersWithFilters({ query: q, roleClauses, limit: 20 });

    const payload = users.map((u: any) => ({
      id: String(u._id || u.id),
      name: u.name,
      email: u.email,
      username: u.username,
      role: u.role,
      team: u.team
    }));

    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to search users' }, { status: 500 });
  }
}
