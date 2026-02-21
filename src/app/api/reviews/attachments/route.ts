import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { addReviewCycleAttachments, emitEvent, fetchReview } from '../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUser = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    displayName: String(payload.name || 'Unknown'),
    email: payload.email ? String(payload.email) : undefined
  };
};

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const body = await request.json();
    const resourceType = String(body.resourceType || '');
    const resourceId = String(body.resourceId || '');
    const resourceTitle = body.resourceTitle ? String(body.resourceTitle) : undefined;
    const cycleId = String(body.cycleId || '');
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    if (!resourceType || !resourceId || !cycleId || attachments.length === 0) {
      return NextResponse.json({ error: 'resourceType, resourceId, cycleId, and attachments are required.' }, { status: 400 });
    }

    const review = await fetchReview(resourceType, resourceId);
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    const currentCycle = review.cycles?.find((c) => c.cycleId === cycleId);
    if (!currentCycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });

    const isReviewer = (currentCycle.reviewers || []).some((r) => String(r.userId) === user.userId);
    if (!isReviewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const updated = await addReviewCycleAttachments({ review, cycleId, attachments });

    await emitEvent({
      ts: new Date().toISOString(),
      type: 'review.cycle.attachmentuploaded',
      actor: user,
      resource: { type: resourceType, id: resourceId, title: resourceTitle },
      payload: { cycleId, attachments },
      correlationId: cycleId
    });

    return NextResponse.json({ review: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to add attachments' }, { status: 500 });
  }
}
