import { NextResponse } from 'next/server';
import { fetchWorkItemByKeyOrId } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key') || '';
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;

  if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  try {
    await jwtVerify(token, JWT_SECRET);
    const item = await fetchWorkItemByKeyOrId(key);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      _id: item._id,
      id: item.id,
      key: item.key,
      title: item.title,
      type: item.type,
      status: item.status
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lookup failed' }, { status: 500 });
  }
}
