
import { NextResponse } from 'next/server';
import { fetchWorkItemById, saveWorkItem } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const item = await fetchWorkItemById(params.id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const itemData = await request.json();
    const result = await saveWorkItem({ ...itemData, _id: params.id }, payload);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 });
  }
}
