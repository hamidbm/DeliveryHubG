import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { updateCommentThreadStatus, emitEvent } from '../../../../services/db';

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

export async function PATCH(request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const user = await getUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { threadId } = await params;
    const body = await request.json();
    const status = body?.status === 'resolved' ? 'resolved' : 'open';
    await updateCommentThreadStatus(threadId, status);

    await emitEvent({
      ts: new Date().toISOString(),
      type: status === 'resolved' ? 'comments.thread.resolved' : 'comments.thread.reopened',
      actor: user,
      resource: { type: body.resourceType || 'wiki.unknown', id: body.resourceId || '' },
      payload: { threadId },
      correlationId: threadId
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update thread' }, { status: 500 });
  }
}
