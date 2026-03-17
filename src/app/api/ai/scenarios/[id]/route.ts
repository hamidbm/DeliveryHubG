import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { deleteAiScenarioRecord } from '../../../../../server/db/repositories/aiWorkspaceRepo';

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

  await deleteAiScenarioRecord(authUser.userId, id);
  return NextResponse.json({ status: 'success' });
}
