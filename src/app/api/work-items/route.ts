
import { NextResponse } from 'next/server';
import { saveWorkItem } from '../../../services/workItemsService';
import { fetchWorkItems } from '../../../server/db/repositories/workItemsRepo';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../services/visibility';
import { invalidateWorkItemScopesFromCandidates } from '../../../services/workItemCache';
import { requireStandardUser, requireUser } from '../../../shared/auth/guards';

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
    sprintId: searchParams.get('sprintId'),
    parentId: searchParams.get('parentId'),
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
  const items = await fetchWorkItems(filters);
  const visibility = createVisibilityContext(authUser);
  const visible = await visibility.filterVisibleWorkItems(items as any[]);
  await visibility.redactWorkItemLinks(visible);
  return NextResponse.json(visible);
}

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const itemData = await request.json();
    const result = await saveWorkItem(itemData, auth.principal.rawPayload);
    await invalidateWorkItemScopesFromCandidates(
      [{ bundleId: itemData?.bundleId, applicationId: itemData?.applicationId }],
      'workitems.create'
    );
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save work item' }, { status: 500 });
  }
}
