import { NextResponse } from 'next/server';
import { fetchWorkItemByKeyOrId } from '../../../../services/workItemsService';
import { requireUser } from '../../../../shared/auth/guards';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key') || '';
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
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
