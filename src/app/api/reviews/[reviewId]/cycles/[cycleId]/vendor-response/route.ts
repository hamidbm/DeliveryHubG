import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { fetchReviewById, updateReviewCycleNote, emitEvent } from '../../../../../../../services/db';

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

export async function POST(request: Request, { params }: { params: Promise<{ reviewId: string; cycleId: string }> }) {
  try {
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { reviewId, cycleId } = await params;
    const review = await fetchReviewById(reviewId);
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    const cycle = (review.cycles || []).find((c) => c.cycleId === cycleId);
    if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    if (String(cycle.requestedBy?.userId || '') !== user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (!['feedback_sent', 'vendor_addressing'].includes(cycle.status)) {
      return NextResponse.json({ error: 'Vendor response cannot be updated at this stage.' }, { status: 409 });
    }

    const body = await request.json();
    const noteBody = String(body?.body || '').trim();
    const ifMatchUpdatedAt = body?.ifMatchUpdatedAt ? String(body.ifMatchUpdatedAt) : null;
    if (ifMatchUpdatedAt && review.updatedAt && new Date(review.updatedAt).getTime() > new Date(ifMatchUpdatedAt).getTime()) {
      return NextResponse.json({ error: 'This review changed since you opened it. Please refresh.' }, { status: 409 });
    }
    if (!noteBody) return NextResponse.json({ error: 'Response body is required.' }, { status: 400 });

    const updated = await updateReviewCycleNote({
      review,
      cycleId,
      vendorResponse: {
        body: noteBody,
        submittedAt: new Date().toISOString(),
        submittedBy: user
      }
    });

    await emitEvent({
      ts: new Date().toISOString(),
      type: 'review.response.saved',
      actor: user,
      resource: { type: review.resource.type, id: review.resource.id, title: review.resource.title },
      payload: { reviewId, cycleId, kind: 'vendor' },
      correlationId: cycleId
    });

    return NextResponse.json({ review: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save vendor response' }, { status: 500 });
  }
}
