import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../services/db';
import { isAdminOrCmo } from '../../../../../services/authz';
import { getNotificationSettings } from '../../../../../services/notifications';
import { queueStaleSummaryForUser } from '../../../../../services/stalenessSummary';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUser = async () => {
  const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
  const cookieStore = testToken ? null : await cookies();
  const token = testToken || cookieStore?.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    role: payload.role ? String(payload.role) : undefined,
    email: payload.email ? String(payload.email) : undefined,
    name: payload.name ? String(payload.name) : undefined
  };
};

export async function POST(request: Request) {
  try {
    const actor = await getUser();
    if (!actor?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId') || actor.userId;
    const allowed = targetUserId === actor.userId || (await isAdminOrCmo(actor));
    if (!allowed) return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });

    const settings = await getNotificationSettings();
    if (settings.enabledTypes && settings.enabledTypes['digest.daily'] === false) {
      return NextResponse.json({ error: 'Digest disabled', code: 'DIGEST_DISABLED' }, { status: 409 });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(targetUserId) });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const dateKey = new Date().toISOString().slice(0, 10);
    await queueStaleSummaryForUser(db, user, dateKey);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const items = await db.collection('notification_digest_queue')
      .find({ userId: targetUserId, createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .toArray();

    if (!items.length) {
      return NextResponse.json({ success: true, created: false, message: 'No digest items found.' });
    }

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

    const now = new Date().toISOString();
    await db.collection('notifications').insertOne({
      recipient: user.name || user.email || String(user._id),
      sender: actor.name || actor.email || 'System',
      type: 'digest.daily',
      title: 'Daily Digest',
      body: lines.join('\n'),
      message: 'Daily Digest',
      severity: 'info',
      read: false,
      createdAt: now
    });

    await db.collection('notification_digest_queue').deleteMany({ _id: { $in: items.map((i: any) => i._id) } });

    return NextResponse.json({ success: true, created: true, count: items.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to send digest' }, { status: 500 });
  }
}
