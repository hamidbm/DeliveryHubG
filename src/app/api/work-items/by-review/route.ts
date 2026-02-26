import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getDb } from '../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const requireAuth = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return { ok: false, status: 401 };
  await jwtVerify(token, JWT_SECRET);
  return { ok: true, status: 200 };
};

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthenticated' }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const reviewId = searchParams.get('reviewId') || undefined;
  const cycleId = searchParams.get('cycleId') || undefined;
  if (!reviewId && !cycleId) {
    return NextResponse.json({ error: 'reviewId or cycleId is required.' }, { status: 400 });
  }

  const db = await getDb();
  const query: any = {};
  if (cycleId) query.reviewCycleId = cycleId;
  if (reviewId) query.reviewId = reviewId;
  const item = await db.collection('workitems').findOne(query);
  return NextResponse.json(item || null);
}
