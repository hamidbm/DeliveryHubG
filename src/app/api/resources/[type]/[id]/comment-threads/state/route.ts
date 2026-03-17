import { NextResponse } from 'next/server';
import { requireUser } from '../../../../../../../shared/auth/guards';
import { countUnreadCommentThreads, getCommentLastSeen, setCommentLastSeen } from '../../../../../../../server/db/repositories/commentThreadsRepo';

export async function GET(_request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const { type, id } = await params;
    const lastSeenAt = await getCommentLastSeen(auth.principal.userId, type, id);
    const unreadCount = await countUnreadCommentThreads(auth.principal.userId, type, id);
    return NextResponse.json({ lastSeenAt, unreadCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load comment state' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const { type, id } = await params;
    const body = await request.json().catch(() => ({}));
    const lastSeenAt = body?.lastSeenAt ? String(body.lastSeenAt) : new Date().toISOString();
    await setCommentLastSeen(auth.principal.userId, type, id, lastSeenAt);
    return NextResponse.json({ success: true, lastSeenAt });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update comment state' }, { status: 500 });
  }
}
