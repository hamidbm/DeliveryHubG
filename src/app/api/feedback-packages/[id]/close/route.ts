import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { closeFeedbackPackage, emitEvent, fetchReview, updateReviewCycleStatus, emitReviewCycleEvent, closeReviewWorkItem, syncReviewCycleWorkItem } from '../../../../../services/db';
import { canCloseCycle } from '../../../../../services/authz';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUser = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    displayName: String(payload.name || 'Unknown'),
    email: payload.email ? String(payload.email) : undefined,
    role: payload.role ? String(payload.role) : undefined
  };
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    if (!(await canCloseCycle(user))) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const resourceType = body.resourceType ? String(body.resourceType) : undefined;
    const resourceId = body.resourceId ? String(body.resourceId) : undefined;
    const resourceTitle = body.resourceTitle ? String(body.resourceTitle) : undefined;

    await closeFeedbackPackage(id, user.userId);

    if (resourceType && resourceId) {
      const review = (await fetchReview(resourceType, resourceId)) as any;
      if (review?.currentCycleId) {
        const cycle = (review.cycles || []).find((c) => c.cycleId === review.currentCycleId);
        if (cycle && cycle.status !== 'closed') {
          await updateReviewCycleStatus({
            review,
            cycleId: review.currentCycleId,
            status: 'closed',
            actor: user
          });
          await emitReviewCycleEvent({
            type: 'reviews.cycle.closed',
            actor: user,
            resource: { type: review.resource.type, id: review.resource.id, title: review.resource.title },
            cycle: { cycleId: review.currentCycleId, number: cycle.number, status: 'closed' }
          });
          await closeReviewWorkItem({
            reviewId: String(review._id || `${review.resource.type}:${review.resource.id}`),
            cycleId: review.currentCycleId,
            actor: user,
            resolution: 'closed'
          });
          await syncReviewCycleWorkItem({ reviewId: String(review._id), cycleId: review.currentCycleId, actor: user });
        }
      }
      await emitEvent({
        ts: new Date().toISOString(),
        type: 'feedback.package.closed',
        actor: user,
        resource: { type: resourceType, id: resourceId, title: resourceTitle },
        payload: { feedbackPackageId: id },
        correlationId: id
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to close feedback package' }, { status: 500 });
  }
}
