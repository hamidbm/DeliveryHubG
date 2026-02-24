import { NextResponse } from 'next/server';
import { getDb } from '../../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    await jwtVerify(token, JWT_SECRET);
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const db = await getDb();
    const asset = await db.collection('workitems_attachments').findOne({ _id: new ObjectId(id) });
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const data = asset.data?.buffer ? asset.data.buffer : asset.data;
    const body = data instanceof Buffer ? data : Buffer.from(data || []);

    return new NextResponse(body, {
      headers: {
        'Content-Type': asset.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${asset.filename || 'attachment'}"`,
        'Cache-Control': 'private, max-age=3600'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Download failed' }, { status: 500 });
  }
}
