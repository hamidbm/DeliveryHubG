import { NextResponse } from 'next/server';
import { requireUser } from '../../../../shared/auth/guards';
import { listCommentThreadsInbox } from '../../../../server/db/repositories/commentThreadsRepo';

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

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

    const threads = await listCommentThreadsInbox({
      userId: auth.principal.userId,
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
