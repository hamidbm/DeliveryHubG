import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const requireAuth = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return { ok: false, status: 401, payload: null };
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return { ok: true, status: 200, payload };
};

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return NextResponse.json({ error: 'Unauthenticated' }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get('q') || '').trim();
    const scope = String(searchParams.get('scope') || 'cmo');

    const db = await getDb();
    const query: any = {};

    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { name: regex },
        { email: regex },
        { username: regex }
      ];
    }

    const roleClauses: any[] = [];
    if (scope === 'cmo') {
      roleClauses.push({ role: { $regex: /CMO/i } });
      roleClauses.push({ team: { $regex: /CMO/i } });
    }

    let adminIds: string[] = [];
    if (searchParams.get('includeAdmin') === 'true') {
      const admins = await db.collection('admins').find({}).toArray();
      adminIds = admins.map((a: any) => String(a.userId)).filter(Boolean);
      if (adminIds.length) {
        roleClauses.push({ _id: { $in: adminIds.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } });
      }
    }

    if (roleClauses.length) {
      query.$and = query.$and || [];
      query.$and.push({ $or: roleClauses });
    }

    const users = await db.collection('users')
      .find(query)
      .limit(20)
      .project({ password: 0 })
      .toArray();

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
