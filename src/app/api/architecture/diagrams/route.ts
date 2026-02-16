
import { NextResponse } from 'next/server';
import { fetchArchitectureDiagrams, saveArchitectureDiagram } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = {
    bundleId: searchParams.get('bundleId'),
    applicationId: searchParams.get('applicationId'),
  };
  const diagrams = await fetchArchitectureDiagrams(filters);
  return NextResponse.json(diagrams);
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const diagramData = await request.json();
    const result = await saveArchitectureDiagram(diagramData, payload);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save diagram' }, { status: 500 });
  }
}
