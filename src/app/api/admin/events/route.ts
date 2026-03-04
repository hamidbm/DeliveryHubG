import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../services/db';
import { isAdminOrCmo } from '../../../../services/authz';
import { normalizeEventType } from '../../../../services/eventsTaxonomy';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const decodeCursor = (cursor: string) => {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !parsed?.id) return null;
    return { ts: parsed.ts, id: parsed.id } as { ts: string; id: string };
  } catch {
    return null;
  }
};

const encodeCursor = (ts: string | Date, id: string) => {
  const payload = { ts: typeof ts === 'string' ? ts : ts.toISOString(), id };
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

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const includePayload = searchParams.get('includePayload') === 'true';

    const db = await getDb();

    if (id) {
      if (!ObjectId.isValid(id)) {
        return NextResponse.json({ error: 'Invalid id', code: 'INVALID_ID' }, { status: 400 });
      }
      const projection = includePayload ? undefined : { payload: 0 };
      const item = await db.collection('events').findOne({ _id: new ObjectId(id) }, { projection });
      const normalized = item?.type ? normalizeEventType(item.type) : null;
      return NextResponse.json({
        item: item ? {
          ...item,
          canonicalType: item.canonicalType || normalized?.canonicalType,
          category: item.category || normalized?.category,
          modulePrefix: item.modulePrefix || normalized?.modulePrefix
        } : null
      });
    }

    const type = searchParams.get('type') || undefined;
    const typePrefix = searchParams.get('typePrefix') || undefined;
    const actor = searchParams.get('actor') || undefined;
    const resourceId = searchParams.get('resourceId') || undefined;
    const resourceType = searchParams.get('resourceType') || undefined;
    const search = searchParams.get('search') || searchParams.get('q') || undefined;
    const start = searchParams.get('start') || resolveRangeStart(searchParams.get('range')) || undefined;
    const end = searchParams.get('end') || undefined;
    const cursor = searchParams.get('cursor') || undefined;
    const limitRaw = Number(searchParams.get('limit') || '50');
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    const filters: any[] = [];

    if (type) filters.push({ type });
    if (!type && typePrefix) {
      filters.push({ type: new RegExp(`^${escapeRegex(typePrefix)}`) });
    }
    if (resourceId) filters.push({ 'resource.id': resourceId });
    if (resourceType) filters.push({ 'resource.type': resourceType });
    if (actor) {
      const regex = new RegExp(escapeRegex(actor), 'i');
      filters.push({
        $or: [
          { 'actor.userId': regex },
          { 'actor.email': regex },
          { 'actor.name': regex },
          { 'actor.displayName': regex }
        ]
      });
    }
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filters.push({
        $or: [
          { type: regex },
          { 'resource.id': regex },
          { 'resource.title': regex },
          { 'actor.userId': regex },
          { 'actor.email': regex },
          { 'actor.name': regex }
        ]
      });
    }
    if (start || end) {
      const range: any = {};
      if (start) range.$gte = new Date(start);
      if (end) range.$lte = new Date(end);
      filters.push({ ts: range });
    }
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        const cursorDate = new Date(decoded.ts);
        const cursorId = ObjectId.isValid(decoded.id) ? new ObjectId(decoded.id) : null;
        if (cursorId) {
          filters.push({
            $or: [
              { ts: { $lt: cursorDate } },
              { ts: cursorDate, _id: { $lt: cursorId } }
            ]
          });
        }
      }
    }

    const query = filters.length ? { $and: filters } : {};
    const projection = includePayload ? undefined : { payload: 0 };

    const items = await db.collection('events')
      .find(query, { projection })
      .sort({ ts: -1, _id: -1 })
      .limit(limit)
      .toArray();

    const normalizedItems = items.map((item: any) => {
      const normalized = item?.type ? normalizeEventType(item.type) : null;
      return {
        ...item,
        canonicalType: item.canonicalType || normalized?.canonicalType,
        category: item.category || normalized?.category,
        modulePrefix: item.modulePrefix || normalized?.modulePrefix
      };
    });

    const last = items[items.length - 1];
    const nextCursor = last ? encodeCursor(last.ts, String(last._id)) : null;

    return NextResponse.json({ items: normalizedItems, nextCursor });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch events' }, { status: 500 });
  }
}
