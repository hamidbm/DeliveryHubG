
import { NextResponse } from 'next/server';
import { fetchWorkItemsBoard } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  
  let currentUser = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      currentUser = payload.name;
    } catch {}
  }

  const filters = {
    bundleId: searchParams.get('bundleId'),
    applicationId: searchParams.get('applicationId'),
    milestoneId: searchParams.get('milestoneId'),
    epicId: searchParams.get('epicId'),
    q: searchParams.get('q'),
    quickFilter: searchParams.get('quickFilter'),
    currentUser
  };
  
  try {
    const board = await fetchWorkItemsBoard(filters);
    return NextResponse.json(board);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch board data' }, { status: 500 });
  }
}
