import { NextResponse } from 'next/server';
import { requireUser } from '../../../../shared/auth/guards';
import { findWorkItemByReviewRefs } from '../../../../server/db/repositories/workItemsRepo';

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const reviewId = searchParams.get('reviewId') || undefined;
  const cycleId = searchParams.get('cycleId') || undefined;
  if (!reviewId && !cycleId) {
    return NextResponse.json({ error: 'reviewId or cycleId is required.' }, { status: 400 });
  }

  const item = await findWorkItemByReviewRefs({ reviewId, cycleId });
  return NextResponse.json(item || null);
}
