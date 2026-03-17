import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { WatcherType } from '../../../../types/ai';
import { createWatcherForUser, evaluateWatchersForUser, getWatcherUsage, listWatchersForUser } from '../../../../services/ai/notificationEngine';
import { fetchAiAnalysisCache } from '../../../../services/aiPersistence';

const CACHE_KEY = 'portfolio-summary';

const isWatcherType = (value: unknown): value is WatcherType => {
  const v = String(value || '').toLowerCase();
  return v === 'alert' || v === 'investigation' || v === 'trend' || v === 'health';
};

const loadPortfolioContext = async () => {
  const cached = await fetchAiAnalysisCache(CACHE_KEY);
  if (!cached) return null;
  const source = cached?.status === 'success'
    ? cached
    : (cached?.report?.status === 'success' ? cached.report : null);
  if (!source?.report) return null;
  return source.report;
};

export async function GET() {
  const authUser = await getAuthUserFromCookies();
  const userId = String(authUser?.userId || '');
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const [watchers, usage] = await Promise.all([listWatchersForUser(userId), getWatcherUsage(userId)]);
  return NextResponse.json({ status: 'success', watchers, usage });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromCookies();
  const userId = String(authUser?.userId || '');
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isWatcherType(body?.type)) {
    return NextResponse.json({ error: 'Invalid watcher type' }, { status: 400 });
  }

  const targetId = String(body?.targetId || '').trim();
  if (!targetId) {
    return NextResponse.json({ error: 'targetId is required' }, { status: 400 });
  }

  let watcherId = '';
  try {
    watcherId = await createWatcherForUser(userId, {
      type: body.type,
      targetId,
      condition: body?.condition && typeof body.condition === 'object' ? body.condition : {},
      enabled: body?.enabled !== false,
      deliveryPreferences: body?.deliveryPreferences && typeof body.deliveryPreferences === 'object'
        ? body.deliveryPreferences
        : undefined
    });
  } catch (error: any) {
    if (error?.code === 'WATCHER_QUOTA_EXCEEDED' || error?.message === 'Watcher quota exceeded') {
      return NextResponse.json({ error: 'Watcher quota exceeded' }, { status: 400 });
    }
    throw error;
  }

  const report = await loadPortfolioContext();
  if (report) {
    await evaluateWatchersForUser(userId, {
      report,
      trendSignals: report.trendSignals,
      healthScore: report.healthScore,
      alerts: report.alerts
    });
  }

  const usage = await getWatcherUsage(userId);
  return NextResponse.json({ status: 'success', watcherId, usage });
}
