import { NextResponse } from 'next/server';
import { getDb, emitEvent } from '../../../../../../services/db';
import { ObjectId } from 'mongodb';
import { getNotificationSettings } from '../../../../../../services/notifications';
import { queueStaleSummaryForUser } from '../../../../../../services/stalenessSummary';

const resolveDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

const ensureDigestRunIndexes = async (db: any) => {
  await db.collection('digest_runs').createIndex({ userId: 1, dateKey: 1 }, { unique: true });
  await db.collection('digest_runs').createIndex({ sentAt: -1 });
};

const ensureDigestQueueIndexes = async (db: any) => {
  await db.collection('notification_digest_queue').createIndex({ userId: 1, createdAt: -1 });
};

const buildDigestBody = (items: any[]) => {
  const grouped = items.reduce((acc: Record<string, any[]>, item: any) => {
    const key = item.type || 'other';
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});

  const lines: string[] = ['Daily Digest'];
  Object.keys(grouped).sort().forEach((type) => {
    lines.push('');
    lines.push(`${type}`);
    grouped[type].forEach((entry: any) => {
      const linkPart = entry.link ? ` (${entry.link})` : '';
      const title = entry.title || entry.body || 'Update';
      lines.push(`- ${title}${linkPart}`);
    });
  });
  return lines.join('\n');
};

export async function POST(request: Request) {
  const start = Date.now();
  try {
    const cronSecret = process.env.DIGEST_CRON_SECRET || '';
    const headerSecret = request.headers.get('X-Cron-Secret') || '';
    if (!cronSecret || headerSecret !== cronSecret) {
      return NextResponse.json({ error: 'Forbidden', code: 'INVALID_CRON_SECRET' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';
    const force = searchParams.get('force') === 'true';
    const batchSize = Math.min(Math.max(Number(searchParams.get('batchSize') || 100), 1), 500);
    const maxUsers = Math.min(Math.max(Number(searchParams.get('maxUsers') || 2000), 1), 5000);

    const settings = await getNotificationSettings();
    if (settings.enabledTypes && settings.enabledTypes['digest.daily'] === false) {
      return NextResponse.json({ error: 'Digest disabled', code: 'DIGEST_DISABLED' }, { status: 409 });
    }

    const db = await getDb();
    await ensureDigestRunIndexes(db);
    await ensureDigestQueueIndexes(db);

    const dateKey = resolveDateKey();

    const users = await db.collection('notification_user_prefs')
      .find({ digestOptIn: true }, { projection: { userId: 1 } })
      .limit(maxUsers)
      .toArray();

    let usersProcessed = 0;
    let digestsSent = 0;
    let totalItems = 0;

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      for (const pref of batch) {
        const userId = String(pref.userId || '');
        if (!userId) continue;
        usersProcessed += 1;

        const existingRun = await db.collection('digest_runs').findOne({ userId, dateKey });
        if (existingRun && !force && !dryRun) continue;

        const user = await db.collection<any>('users').findOne({ _id: new ObjectId(userId) });
        if (!user) continue;

        if (!dryRun) {
          await queueStaleSummaryForUser(db, user, dateKey);
        }

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const items = await db.collection('notification_digest_queue')
          .find({ userId, createdAt: { $gte: since } })
          .sort({ createdAt: -1 })
          .toArray();

        if (!items.length) continue;

        if (dryRun) {
          digestsSent += 1;
          totalItems += items.length;
          continue;
        }

        const recipientName = user?.name || user?.email || userId;
        const body = buildDigestBody(items);

        await db.collection('notifications').insertOne({
          recipient: recipientName,
          sender: 'DeliveryHub',
          type: 'digest.daily',
          title: 'Daily Digest',
          body,
          message: 'Daily Digest',
          severity: 'info',
          read: false,
          createdAt: new Date().toISOString()
        });

        await db.collection('digest_runs').updateOne(
          { userId, dateKey },
          { $set: { userId, dateKey, sentAt: new Date().toISOString(), countItems: items.length } },
          { upsert: true }
        );

        await db.collection('notification_digest_queue').deleteMany({ _id: { $in: items.map((i: any) => i._id) } });

        digestsSent += 1;
        totalItems += items.length;
      }
    }

    const durationMs = Date.now() - start;
    try {
      await emitEvent({
        ts: new Date().toISOString(),
        type: 'perf.digestRun',
        actor: { userId: 'cron', displayName: 'Cron' },
        resource: { type: 'notifications.digest', id: dateKey, title: 'Digest Run' },
        payload: { usersProcessed, digestsSent, totalItems, durationMs, dryRun }
      });
    } catch {}

    return NextResponse.json({
      usersProcessed,
      digestsSent,
      totalItems,
      durationMs,
      dryRun
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to run digest' }, { status: 500 });
  }
}
