import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { listWorkPlanPreviewRecords } from '../../../../../server/db/repositories/workPlansRepo';

export async function GET(request: Request) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || '10'), 1), 50);
    const scopeType = searchParams.get('scopeType') || undefined;
    const scopeId = searchParams.get('scopeId') || undefined;
    const previews = await listWorkPlanPreviewRecords({
      createdBy: String(user.userId),
      scopeType,
      scopeId,
      limit
    });
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
