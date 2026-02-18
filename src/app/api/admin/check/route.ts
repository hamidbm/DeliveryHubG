import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { isAdmin } from '../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUserId = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return String(payload.id || payload.userId || '');
};

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ isAdmin: false }, { status: 401 });
    const allowed = await isAdmin(userId);
    return NextResponse.json({ isAdmin: allowed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Admin check failed' }, { status: 500 });
  }
}
