import { NextResponse } from 'next/server';
import { isAdminOrCmo } from '../../../../../services/authz';
import { getNotificationSettings } from '../../../../../services/notifications';
import { queueStaleSummaryForUser } from '../../../../../services/stalenessSummary';
import { requireStandardUser } from '../../../../../shared/auth/guards';
import {
  deleteNotificationDigestQueueItemsByIds,
  insertClassicNotification,
  listNotificationDigestQueueItemsForUserSince
} from '../../../../../server/db/repositories/notificationPlatformRepo';
import { findUserById } from '../../../../../server/db/repositories/usersRepo';

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const actor = {
      userId: auth.principal.userId,
      role: auth.principal.role || undefined,
      email: auth.principal.email,
      name: auth.principal.fullName || undefined,
      accountType: auth.principal.accountType
    };
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId') || actor.userId;
    const allowed = targetUserId === actor.userId || (await isAdminOrCmo(actor));
    if (!allowed) return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });

    const settings = await getNotificationSettings();
    if (settings.enabledTypes && settings.enabledTypes['digest.daily'] === false) {
      return NextResponse.json({ error: 'Digest disabled', code: 'DIGEST_DISABLED' }, { status: 409 });
    }

    const user = await findUserById(targetUserId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const dateKey = new Date().toISOString().slice(0, 10);
    await queueStaleSummaryForUser(null, user, dateKey);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const items = await listNotificationDigestQueueItemsForUserSince(targetUserId, since);

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
    await insertClassicNotification({
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

    await deleteNotificationDigestQueueItemsByIds(items.map((i: any) => i._id));

    return NextResponse.json({ success: true, created: true, count: items.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to send digest' }, { status: 500 });
  }
}
