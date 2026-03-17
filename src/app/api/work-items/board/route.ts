
import { NextResponse } from 'next/server';
import { fetchWorkItemsBoard } from '../../../../server/db/repositories/workItemsRepo';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../services/visibility';
import { requireUser } from '../../../../shared/auth/guards';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const filters = {
    bundleId: searchParams.get('bundleId'),
    applicationId: searchParams.get('applicationId'),
    milestoneId: searchParams.get('milestoneId'),
    epicId: searchParams.get('epicId'),
    q: searchParams.get('q'),
    quickFilter: searchParams.get('quickFilter'),
    types: searchParams.get('types'),
    priorities: searchParams.get('priorities'),
    health: searchParams.get('health'),
    includeArchived: searchParams.get('includeArchived') === 'true',
    currentUser: auth.principal.fullName || null,
    currentUserId: auth.principal.userId || null,
    currentUserName: auth.principal.fullName || auth.principal.username || auth.principal.email || null,
    currentUserEmail: auth.principal.email || null,
    currentUsername: auth.principal.username || null
  };
  
  try {
    const board = await fetchWorkItemsBoard(filters);
    const visibility = createVisibilityContext(authUser);
    const columns = await Promise.all((board.columns || []).map(async (col: any) => {
      const visibleItems = await visibility.filterVisibleWorkItems(col.items || []);
      await visibility.redactWorkItemLinks(visibleItems);
      return { ...col, items: visibleItems };
    }));
    return NextResponse.json({ ...board, columns });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch board data' }, { status: 500 });
  }
}
