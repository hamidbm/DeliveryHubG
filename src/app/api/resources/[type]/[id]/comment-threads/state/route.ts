import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { fetchCommentUnreadCount, getCommentLastSeen, setCommentLastSeen } from '../../../../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUserFromCookies = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || '')
  };
};

export async function GET(_request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    const user = await getUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { type, id } = await params;
    const lastSeenAt = await getCommentLastSeen(user.userId, type, id);
    const unreadCount = await fetchCommentUnreadCount(user.userId, type, id);
    return NextResponse.json({ lastSeenAt, unreadCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load comment state' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    const user = await getUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { type, id } = await params;
    const body = await request.json().catch(() => ({}));
    const lastSeenAt = body?.lastSeenAt ? String(body.lastSeenAt) : new Date().toISOString();
    await setCommentLastSeen(user.userId, type, id, lastSeenAt);
    return NextResponse.json({ success: true, lastSeenAt });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update comment state' }, { status: 500 });
  }
}
