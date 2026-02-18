import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { fetchEvents, setUserEventState } from '../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUserFromCookies = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    displayName: String(payload.name || 'Unknown'),
    email: payload.email ? String(payload.email) : undefined
  };
};

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || '200');
    const type = searchParams.get('type') || undefined;
    const resourceType = searchParams.get('resourceType') || undefined;
    const resourceId = searchParams.get('resourceId') || undefined;
    const actorId = searchParams.get('actorId') || undefined;
    const since = searchParams.get('since') || undefined;
    const markSeen = searchParams.get('markSeen') === 'true';
    const mentionsOnly = searchParams.get('mentionsOnly') === 'true';

    const events = await fetchEvents({
      limit,
      type: mentionsOnly ? 'comments.message.mentioned' : type,
      resourceType,
      resourceId,
      actorId,
      since,
      mentionUserId: mentionsOnly ? user.userId : undefined
    });
    if (markSeen) {
      await setUserEventState(user.userId, new Date().toISOString());
    }
    return NextResponse.json({ events });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch events' }, { status: 500 });
  }
}
