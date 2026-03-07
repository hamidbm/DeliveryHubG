import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { getDb } from '../../../../../services/db';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || '10'), 1), 50);
    const scopeType = searchParams.get('scopeType') || undefined;
    const scopeId = searchParams.get('scopeId') || undefined;
    const db = await getDb();
    const query: any = { createdBy: String(user.userId) };
    if (scopeType) query.scopeType = scopeType;
    if (scopeId) query.scopeId = scopeId;
    const previews = await db.collection('work_plan_previews')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    return NextResponse.json(previews.map((doc: any) => ({
      id: String(doc._id || doc.id || ''),
      createdAt: doc.createdAt,
      scopeType: doc.scopeType,
      scopeId: doc.scopeId,
      input: doc.input,
      preview: doc.preview
    })));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load previews' }, { status: 400 });
  }
}
