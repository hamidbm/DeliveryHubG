
import { NextResponse } from 'next/server';
import { searchUsers } from '../../../../services/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  
  try {
    const users = await searchUsers(q);
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
  }
}
