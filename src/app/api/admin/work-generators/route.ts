import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getDb, isAdmin } from '../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const requireAdmin = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return { ok: false, status: 401 };
  const { payload } = await jwtVerify(token, JWT_SECRET);
  const userId = String(payload.id || payload.userId || '');
  const allowed = await isAdmin(userId);
  return { ok: allowed, status: allowed ? 200 : 403 };
};

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  const db = await getDb();
  const items = await db.collection('work_generators').find({}).sort({ createdAt: -1 }).toArray();
  return NextResponse.json(items);
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  const body = await request.json();
  const eventType = String(body.eventType || '');
  if (!eventType) return NextResponse.json({ error: 'eventType required' }, { status: 400 });
  const db = await getDb();
  const update: any = {};
  if (typeof body.enabled === 'boolean') update.enabled = body.enabled;
  await db.collection('work_generators').updateOne({ eventType }, { $set: update });
  return NextResponse.json({ success: true });
}
