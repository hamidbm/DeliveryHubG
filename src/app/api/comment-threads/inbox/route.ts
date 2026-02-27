import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { fetchCommentThreadsInbox } from '../../../../services/db';

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
    const resourceType = searchParams.get('resourceType') || undefined;
    const status = searchParams.get('status') === 'resolved' ? 'resolved' : searchParams.get('status') === 'open' ? 'open' : undefined;
    const since = searchParams.get('since') || undefined;
    const search = searchParams.get('search') || undefined;
    const scope = searchParams.get('scope') || 'open';
    const mentionsOnly = searchParams.get('mentionsOnly') === 'true';

    const resolvedMentionsOnly = scope === 'mentions' ? true : mentionsOnly;
    const participatingOnly = scope === 'participating';
    const resolvedStatus = scope === 'open' && !status ? 'open' : status;

    const threads = await fetchCommentThreadsInbox({
      userId: user.userId,
      resourceType,
      status: resolvedStatus,
      mentionsOnly: resolvedMentionsOnly,
      participatingOnly,
      since,
      search,
      limit
    });

    return NextResponse.json({ threads });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load threads' }, { status: 500 });
  }
}
