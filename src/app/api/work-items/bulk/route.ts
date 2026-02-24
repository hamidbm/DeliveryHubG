
import { NextResponse } from 'next/server';
import { getDb } from '../../../../services/db';
import { ObjectId } from 'mongodb';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const { ids, updates } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const userName = payload.name as string || 'System';

    if (updates && (updates.assignedTo !== undefined || updates.priority !== undefined)) {
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
      if (!privilegedRoles.has(userRole)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Prepare audit log entry for the bulk operation
    const auditEntry = {
      user: userName,
      action: 'BULK_UPDATE',
      field: Object.keys(updates).join(', '),
      to: 'Multiple Values (Bulk)',
      createdAt: now
    };

    const result = await db.collection('workitems').updateMany(
      { _id: { $in: ids.map(id => new ObjectId(id)) } },
      { 
        $set: { ...updates, updatedAt: now, updatedBy: userName },
        $push: { activity: auditEntry as any }
      }
    );

    return NextResponse.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bulk update failed' }, { status: 500 });
  }
}
