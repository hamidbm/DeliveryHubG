
import { NextResponse } from 'next/server';
import { getDb } from '../../../../services/db';
import { ObjectId } from 'mongodb';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const data = await request.json();
    const db = await getDb();
    
    const result = await db.collection('applications').updateOne(
      { _id: new ObjectId(params.id) },
      { $set: data }
    );

    return NextResponse.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    return NextResponse.json({ error: 'Patch failed' }, { status: 500 });
  }
}
