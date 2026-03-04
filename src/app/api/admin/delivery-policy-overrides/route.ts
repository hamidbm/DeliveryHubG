import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { isAdminOrCmo } from '../../../../services/authz';
import { getMongoClientPromise } from '../../../../lib/mongodb';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getAuthUser = async () => {
  const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
  const cookieStore = testToken ? null : await cookies();
  const token = testToken || cookieStore?.get('nexus_auth_token')?.value;
  if (!token) return { token: null, payload: null };
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return { token, payload };
};

export async function GET() {
  try {
    const { token, payload } = await getAuthUser();
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const authUser = {
      userId: String((payload as any).id || (payload as any).userId || ''),
      role: String((payload as any).role || ''),
      team: String((payload as any).team || '')
    };
    if (!(await isAdminOrCmo(authUser))) {
      return NextResponse.json({ error: 'FORBIDDEN_POLICY_READ' }, { status: 403 });
    }

    const client = await getMongoClientPromise();
    const db = client.db();
    const overrides = await db.collection('delivery_policy_overrides')
      .find({}, { projection: { _id: 0, bundleId: 1, version: 1, updatedAt: 1, updatedBy: 1 } })
      .toArray();

    return NextResponse.json({ overrides });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load policy overrides' }, { status: 500 });
  }
}
