import { NextResponse } from 'next/server';
import { fetchWorkItemById, getDb, emitEvent } from '../../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const userName = String(payload.name || '');
    const userRole = String((payload as any).role || '');
    const privilegedRoles = new Set([
      'CMO Architect',
      'SVP Architect',
      'SVP PM',
      'SVP Engineer',
      'Director',
      'VP',
      'CIO'
    ]);
    const isOwner = userName && (item.assignedTo === userName || item.createdBy === userName);
    if (!isOwner && !privilegedRoles.has(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    await db.collection('workitems').updateOne(
      { _id: new ObjectId(id) },
      { $set: { isArchived: false, updatedAt: now }, $unset: { archivedAt: '', archivedBy: '' } }
    );

    try {
      await emitEvent({
        ts: now,
        type: 'workitems.item.restored',
        actor: {
          userId: String((payload as any).id || (payload as any).userId || (payload as any).email || userName),
          displayName: String((payload as any).name || (payload as any).displayName || userName),
          email: (payload as any).email ? String((payload as any).email) : undefined
        },
        resource: { type: 'workitems.item', id: String(item._id || item.id || id), title: item.title },
        context: { bundleId: item.bundleId, appId: item.applicationId }
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Restore failed' }, { status: 500 });
  }
}
