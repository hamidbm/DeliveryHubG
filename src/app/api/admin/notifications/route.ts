import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../services/db';
import { isAdminOrCmo } from '../../../../services/authz';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const decodeCursor = (cursor: string) => {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (!parsed?.createdAt || !parsed?.id) return null;
    return { createdAt: parsed.createdAt, id: parsed.id } as { createdAt: string; id: string };
  } catch {
    return null;
  }
};

const encodeCursor = (createdAt: string, id: string) => {
  const payload = { createdAt, id };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
};

const resolveRangeStart = (range?: string | null) => {
  if (!range || range === 'all') return null;
  const now = Date.now();
  if (range === '24h') return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  if (range === '7d') return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (range === '30d') return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  return null;
};

const getUser = async () => {
  const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
  const cookieStore = testToken ? null : await cookies();
  const token = testToken || cookieStore?.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    role: payload.role ? String(payload.role) : undefined,
    email: payload.email ? String(payload.email) : undefined
  };
};

const requireAdmin = async () => {
  const user = await getUser();
  if (!user?.userId) return { ok: false, status: 401, user: null };
  const allowed = await isAdminOrCmo(user);
  if (!allowed) return { ok: false, status: 403, user };
  return { ok: true, status: 200, user };
};

const parsePaging = (searchParams: URLSearchParams) => {
  const cursor = searchParams.get('cursor') || undefined;
  const limitRaw = Number(searchParams.get('limit') || '50');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
  return { cursor, limit };
};

const applyCursorFilter = (filters: any[], cursor?: string) => {
  if (!cursor) return;
  const decoded = decodeCursor(cursor);
  if (!decoded) return;
  const cursorId = ObjectId.isValid(decoded.id) ? new ObjectId(decoded.id) : null;
  if (!cursorId) return;
  filters.push({
    $or: [
      { createdAt: { $lt: decoded.createdAt } },
      { createdAt: decoded.createdAt, _id: { $lt: cursorId } }
    ]
  });
};

const listClassicNotifications = async (db: any, searchParams: URLSearchParams) => {
  const id = searchParams.get('id');
  const includePayload = searchParams.get('includePayload') === 'true';

  if (id) {
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid id', code: 'INVALID_ID' }, { status: 400 });
    }
    const projection = includePayload ? undefined : { payload: 0 };
    const item = await db.collection('notifications').findOne({ _id: new ObjectId(id) }, { projection });
    return NextResponse.json({ item });
  }

  const recipient = searchParams.get('recipient') || undefined;
  const type = searchParams.get('type') || undefined;
  const unreadOnly = searchParams.get('unreadOnly') === 'true';
  const search = searchParams.get('search') || searchParams.get('q') || undefined;
  const start = searchParams.get('start') || resolveRangeStart(searchParams.get('range')) || undefined;
  const end = searchParams.get('end') || undefined;
  const { cursor, limit } = parsePaging(searchParams);

  const filters: any[] = [];

  if (recipient) {
    const regex = new RegExp(escapeRegex(recipient), 'i');
    filters.push({ recipient: regex });
  }
  if (type) filters.push({ type });
  if (unreadOnly) filters.push({ read: false });
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filters.push({
      $or: [
        { recipient: regex },
        { sender: regex },
        { type: regex },
        { title: regex },
        { body: regex }
      ]
    });
  }
  if (start || end) {
    const range: any = {};
    if (start) range.$gte = new Date(start).toISOString();
    if (end) range.$lte = new Date(end).toISOString();
    filters.push({ createdAt: range });
  }

  applyCursorFilter(filters, cursor);

  const query = filters.length ? { $and: filters } : {};
  const projection = includePayload ? undefined : { payload: 0 };

  const items = await db.collection('notifications')
    .find(query, { projection })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .toArray();

  const last = items[items.length - 1];
  const nextCursor = last ? encodeCursor(String(last.createdAt || ''), String(last._id)) : null;

  return NextResponse.json({ items, nextCursor });
};

const listAiNotifications = async (db: any, searchParams: URLSearchParams) => {
  const { cursor, limit } = parsePaging(searchParams);
  const channel = String(searchParams.get('channel') || '').trim();
  const status = String(searchParams.get('status') || '').trim();
  const user = String(searchParams.get('user') || searchParams.get('recipient') || '').trim();
  const watcherId = String(searchParams.get('watcherId') || '').trim();
  const search = String(searchParams.get('search') || searchParams.get('q') || '').trim();
  const start = searchParams.get('start') || resolveRangeStart(searchParams.get('range')) || undefined;
  const end = searchParams.get('end') || undefined;

  const filters: any[] = [];

  if (user) {
    const regex = new RegExp(escapeRegex(user), 'i');
    filters.push({ userId: regex });
  }
  if (watcherId) {
    filters.push({ watcherId: watcherId });
  }
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filters.push({
      $or: [
        { userId: regex },
        { watcherId: regex },
        { title: regex },
        { message: regex }
      ]
    });
  }
  if (start || end) {
    const range: any = {};
    if (start) range.$gte = new Date(start).toISOString();
    if (end) range.$lte = new Date(end).toISOString();
    filters.push({ createdAt: range });
  }

  const allowedChannels = new Set(['email', 'slack', 'teams', 'in_app']);
  if (channel && allowedChannels.has(channel)) {
    if (status) {
      filters.push({ [`delivery.${channel}.status`]: status });
    } else {
      filters.push({ [`delivery.${channel}`]: { $exists: true } });
    }
  } else if (status) {
    if (status === 'read') {
      filters.push({ read: true });
    } else if (status === 'unread') {
      filters.push({ read: false });
    } else {
      filters.push({
        $or: [
          { 'delivery.email.status': status },
          { 'delivery.slack.status': status },
          { 'delivery.teams.status': status },
          { 'delivery.in_app.status': status }
        ]
      });
    }
  }

  applyCursorFilter(filters, cursor);

  const query = filters.length ? { $and: filters } : {};
  const items = await db.collection('ai_notifications')
    .find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .toArray();

  const last = items[items.length - 1];
  const nextCursor = last ? encodeCursor(String(last.createdAt || ''), String(last._id)) : null;

  return NextResponse.json({ items, nextCursor, source: 'ai' });
};

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const db = await getDb();

    if (searchParams.get('source') === 'ai') {
      return listAiNotifications(db, searchParams);
    }

    return listClassicNotifications(db, searchParams);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch notifications' }, { status: 500 });
  }
}
