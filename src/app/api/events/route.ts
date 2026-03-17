import { NextResponse } from 'next/server';
import { listEvents, saveUserEventStateRecord } from '../../../server/db/repositories/eventsRepo';
import { requireUser } from '../../../shared/auth/guards';

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || '200');
    const type = searchParams.get('type') || undefined;
    const typePrefix = searchParams.get('typePrefix') || undefined;
    const resourceType = searchParams.get('resourceType') || undefined;
    const resourceId = searchParams.get('resourceId') || undefined;
    const actorId = searchParams.get('actorId') || undefined;
    const since = searchParams.get('since') || undefined;
    const markSeen = searchParams.get('markSeen') === 'true';
    const mentionsOnly = searchParams.get('mentionsOnly') === 'true';
    const bundleId = searchParams.get('bundleId') || undefined;
    const appId = searchParams.get('appId') || undefined;
    const milestoneId = searchParams.get('milestoneId') || undefined;
    const documentTypeId = searchParams.get('documentTypeId') || undefined;
    const search = searchParams.get('search') || undefined;

    const events = await listEvents({
      limit,
      type: mentionsOnly ? 'comments.message.mentioned' : type,
      typePrefix,
      resourceType,
      resourceId,
      actorId,
      since,
      mentionUserId: mentionsOnly ? auth.principal.userId : undefined,
      bundleId,
      appId,
      milestoneId,
      documentTypeId,
      search
    });
    if (markSeen) {
      await saveUserEventStateRecord(auth.principal.userId, new Date().toISOString());
    }
    return NextResponse.json({ events });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch events' }, { status: 500 });
  }
}
