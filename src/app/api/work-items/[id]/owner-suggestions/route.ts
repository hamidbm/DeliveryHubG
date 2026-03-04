import { NextResponse } from 'next/server';
import { fetchWorkItemById } from '../../../../../services/db';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../../services/visibility';
import { suggestOwnersForWorkItem } from '../../../../../services/ownership';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const item = await fetchWorkItemById(id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const visibility = createVisibilityContext(authUser);
  if (!(await visibility.canViewWorkItem(item))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const suggestions = await suggestOwnersForWorkItem(String(item._id || item.id || id));
  return NextResponse.json(suggestions);
}
