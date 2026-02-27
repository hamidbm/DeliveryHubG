import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { isAdmin } from '../../../../services/db';
import { Role } from '../../../../types';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUserInfo = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    role: payload.role ? String(payload.role) : undefined
  };
};

export async function GET() {
  try {
    const user = await getUserInfo();
    if (!user?.userId) return NextResponse.json({ isAdmin: false, isCmo: false }, { status: 401 });
    const allowed = await isAdmin(user.userId);
    const isCmo = user.role === Role.CMO_MEMBER;
    return NextResponse.json({ isAdmin: allowed, isCmo });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Admin check failed' }, { status: 500 });
  }
}
