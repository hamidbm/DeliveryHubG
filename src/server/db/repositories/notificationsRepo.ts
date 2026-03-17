import { ObjectId } from 'mongodb';
import type { Principal } from '../../../shared/auth/roles';
import { getServerDb } from '../client';

type UnifiedNotification = {
  _id: string;
  read: boolean;
  createdAt: string;
  type: string;
  title?: string;
  message: string;
  body?: string;
  link?: string;
  severity?: string;
  sender?: string;
  source: 'classic' | 'ai';
  userId?: string;
  watcherId?: string;
};

const toObjectId = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : id);

const buildClassicRecipientCandidates = (principal: Principal) =>
  Array.from(new Set([
    principal.userId,
    principal.email || '',
    principal.fullName || '',
    principal.username || ''
  ].map((value) => String(value || '').trim()).filter(Boolean)));

const normalizeClassicNotification = (row: any): UnifiedNotification => ({
  _id: String(row._id || row.id || ''),
  read: Boolean(row.read),
  createdAt: String(row.createdAt || new Date().toISOString()),
  type: String(row.type || 'NOTIFICATION'),
  title: row.title ? String(row.title) : undefined,
  message: String(row.message || row.body || row.title || ''),
  body: row.body ? String(row.body) : undefined,
  link: row.link ? String(row.link) : undefined,
  severity: row.severity ? String(row.severity) : undefined,
  sender: row.sender ? String(row.sender) : undefined,
  source: 'classic'
});

const normalizeAiNotification = (row: any): UnifiedNotification => ({
  _id: String(row._id || row.id || ''),
  read: Boolean(row.read),
  createdAt: String(row.createdAt || new Date().toISOString()),
  type: String(row.type || 'AI_NOTIFICATION'),
  title: row.title ? String(row.title) : undefined,
  message: String(row.message || row.title || ''),
  body: row.message ? String(row.message) : undefined,
  link: row.relatedInvestigationId ? `/ai/executive-insights?investigation=${encodeURIComponent(String(row.relatedInvestigationId))}` : undefined,
  severity: row.severity ? String(row.severity) : undefined,
  source: 'ai',
  userId: row.userId ? String(row.userId) : undefined,
  watcherId: row.watcherId ? String(row.watcherId) : undefined
});

export const listUnifiedNotificationsForPrincipal = async (principal: Principal, limit = 200): Promise<UnifiedNotification[]> => {
  const db = await getServerDb();
  const recipientCandidates = buildClassicRecipientCandidates(principal);

  const [classicRows, aiRows] = await Promise.all([
    recipientCandidates.length
      ? db.collection('notifications')
          .find({
            $or: [
              { recipient: { $in: recipientCandidates } },
              { recipientUserId: principal.userId }
            ]
          })
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit)
          .toArray()
      : [],
    db.collection('ai_notifications')
      .find({ userId: principal.userId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .toArray()
  ]);

  return [...classicRows.map(normalizeClassicNotification), ...aiRows.map(normalizeAiNotification)]
    .sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, limit);
};

export const markUnifiedNotificationReadForPrincipal = async (
  principal: Principal,
  notificationId: string,
  read: boolean
): Promise<boolean> => {
  const db = await getServerDb();
  const recipientCandidates = buildClassicRecipientCandidates(principal);
  const classicResult = await db.collection('notifications').updateOne(
    {
      _id: toObjectId(notificationId),
      $or: [
        { recipient: { $in: recipientCandidates } },
        { recipientUserId: principal.userId }
      ]
    } as any,
    { $set: { read: Boolean(read) } }
  );
  if (classicResult.matchedCount > 0) return true;

  const aiResult = await db.collection('ai_notifications').updateOne(
    { _id: toObjectId(notificationId), userId: principal.userId } as any,
    { $set: { read: Boolean(read) } }
  );
  return aiResult.matchedCount > 0;
};
