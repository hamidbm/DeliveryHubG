import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getDb } from '../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const requireAuth = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return { ok: false, status: 401, payload: null };
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return { ok: true, status: 200, payload };
};

const parseBool = (value: string | null) => value === 'true' || value === '1';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return NextResponse.json({ error: 'Unauthenticated' }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const bundleId = searchParams.get('bundleId');
    const status = searchParams.get('status');
    const assignedToMe = parseBool(searchParams.get('assignedToMe'));
    const requestedByMe = parseBool(searchParams.get('requestedByMe'));
    const overdue = parseBool(searchParams.get('overdue'));
    const q = searchParams.get('q');
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 25)));
    const sort = searchParams.get('sort') || 'updatedAt';
    const dir = searchParams.get('dir') === 'asc' ? 1 : -1;

    const query: any = {};
    if (bundleId) {
      const bundleIds = bundleId.split(',').map((id) => id.trim()).filter(Boolean);
      if (bundleIds.length === 1) query['resource.bundleId'] = bundleIds[0];
      if (bundleIds.length > 1) query['resource.bundleId'] = { $in: bundleIds };
    }
    if (status) query.currentCycleStatus = status;
    if (assignedToMe && auth.payload?.userId) {
      query.currentReviewerUserIds = String(auth.payload.userId);
    }
    if (requestedByMe && auth.payload?.userId) {
      query.currentRequestedByUserId = String(auth.payload.userId);
    }
    if (overdue) {
      query.currentDueAt = { $ne: null, $lt: new Date().toISOString() };
      query.currentCycleStatus = { $ne: 'closed' };
    }
    if (q) {
      query['resource.title'] = { $regex: q, $options: 'i' };
    }

    const sortField =
      sort === 'dueAt' ? 'currentDueAt' :
      sort === 'requestedAt' ? 'currentRequestedAt' :
      'updatedAt';
    const sortClause: Record<string, number> = { [sortField]: dir };

    const db = await getDb();
    const total = await db.collection('reviews').countDocuments(query);
    const reviews = await db.collection('reviews')
      .find(query)
      .sort(sortClause)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();

    const items = reviews.map((review: any) => {
      const currentCycle = (review.cycles || []).find((c: any) => c.cycleId === review.currentCycleId);
      const reviewersPreview = (currentCycle?.reviewers || []).slice(0, 2).map((r: any) => ({
        displayName: r.displayName || r.email || r.userId,
        userId: r.userId
      }));
      return {
        reviewId: String(review._id),
        resource: {
          type: review.resource?.type,
          id: review.resource?.id,
          title: review.resource?.title,
          bundleId: review.resource?.bundleId
        },
        currentCycle: currentCycle ? {
          number: currentCycle.number,
          status: currentCycle.status,
          dueAt: currentCycle.dueAt,
          requestedAt: currentCycle.requestedAt
        } : null,
        reviewersPreview,
        cycleCount: Array.isArray(review.cycles) ? review.cycles.length : 0,
        updatedAt: review.updatedAt
      };
    });

    return NextResponse.json({ items, total, page, pageSize });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch reviews' }, { status: 500 });
  }
}
