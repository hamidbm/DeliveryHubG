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
  const items = await db.collection('work_blueprints').find({}).sort({ createdAt: -1 }).toArray();
  return NextResponse.json(items);
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  const body = await request.json();
  const key = String(body.key || '');
  if (!key) return NextResponse.json({ error: 'Key required' }, { status: 400 });
  const db = await getDb();

  if (body.isDefault) {
    await db.collection('work_blueprints').updateMany({}, { $set: { isDefault: false } });
  }
  const update: any = {};
  if (typeof body.enabled === 'boolean') update.enabled = body.enabled;
  if (typeof body.isDefault === 'boolean') update.isDefault = body.isDefault;
  await db.collection('work_blueprints').updateOne({ key }, { $set: update });
  return NextResponse.json({ success: true });
}
