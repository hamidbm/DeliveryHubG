
import { NextResponse } from 'next/server';
import { fetchWorkItems, saveWorkItem } from '../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../services/visibility';
import { invalidateWorkItemScopesFromCandidates } from '../../../services/workItemCache';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
  const cookieStore = testToken ? null : await cookies();
  const token = testToken || cookieStore?.get('nexus_auth_token')?.value;
  
  let currentUser = null;
  let currentUserId = null;
  let currentUserName = null;
  let currentUserEmail = null;
  let currentUsername = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      currentUser = payload.name;
      currentUserId = payload.id || payload.userId || null;
      currentUserName = payload.name || payload.username || payload.email || null;
      currentUserEmail = payload.email || null;
      currentUsername = payload.username || null;
    } catch {}
  }

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
    currentUser,
    currentUserId,
    currentUserName,
    currentUserEmail,
    currentUsername
  };
  const items = await fetchWorkItems(filters);
  const visibility = createVisibilityContext(authUser);
  const visible = await visibility.filterVisibleWorkItems(items as any[]);
  await visibility.redactWorkItemLinks(visible);
  return NextResponse.json(visible);
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const itemData = await request.json();
    const result = await saveWorkItem(itemData, payload);
    await invalidateWorkItemScopesFromCandidates(
      [{ bundleId: itemData?.bundleId, applicationId: itemData?.applicationId }],
      'workitems.create'
    );
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save work item' }, { status: 500 });
  }
}
