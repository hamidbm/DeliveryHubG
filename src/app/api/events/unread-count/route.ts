import { NextResponse } from 'next/server';
import { countUnreadEvents } from '../../../../server/db/repositories/eventsRepo';
import { requireUser } from '../../../../shared/auth/guards';

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const count = await countUnreadEvents(auth.principal.userId);
    return NextResponse.json({ count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch unread count' }, { status: 500 });
  }
}
