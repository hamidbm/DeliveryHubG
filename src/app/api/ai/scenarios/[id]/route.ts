import { NextResponse } from 'next/server';
import { getDb } from '../../../../../services/db';
import { getAuthUserFromCookies } from '../../../../../services/visibility';

const COLLECTION = 'ai_scenarios';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json({ status: 'error', error: 'Unauthenticated' }, { status: 401 });
  }

  const p = await params;
  const id = String(p?.id || '').trim();
  if (!id) {
    return NextResponse.json({ status: 'error', error: 'Scenario id is required.' }, { status: 400 });
  }

  const db = await getDb();
  await db.collection(COLLECTION).deleteOne({ userId: authUser.userId, id });
  return NextResponse.json({ status: 'success' });
}
