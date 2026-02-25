
import { NextResponse } from 'next/server';
import { fetchWorkItemTree } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  
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
    epicId: searchParams.get('epicId'),
    parentId: searchParams.get('parentId'),
    q: searchParams.get('q'),
    quickFilter: searchParams.get('quickFilter'),
    types: searchParams.get('types'),
    priorities: searchParams.get('priorities'),
    health: searchParams.get('health'),
    includeArchived: searchParams.get('includeArchived') === 'true',
    treeMode: searchParams.get('treeMode') || 'hierarchy',
    currentUser,
    currentUserId,
    currentUserName,
    currentUserEmail,
    currentUsername
  };
  const tree = await fetchWorkItemTree(filters);
  return NextResponse.json(tree);
}
