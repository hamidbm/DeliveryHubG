
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/services/db';
import { ObjectId } from 'mongodb';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const db = await getDb();
    
    const result = await db.collection('applications').updateOne(
      { _id: new ObjectId(id) },
      { $set: data }
    );

    return NextResponse.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    return NextResponse.json({ error: 'Patch failed' }, { status: 500 });
  }
}
