import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { getDb, emitEvent } from '../../../../../services/db';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { isAdminOrCmo } from '../../../../../services/authz';

const DEFAULT_INCLUDE = ['policies', 'overrides', 'bundles', 'assignments', 'milestones', 'scope-requests'];

const COLLECTION_MAP: Record<string, string> = {
  policies: 'delivery_policies',
  overrides: 'delivery_policy_overrides',
  notification_settings: 'notification_settings',
  notification_prefs: 'notification_user_prefs',
  bundles: 'bundles',
  assignments: 'bundle_assignments',
  milestones: 'milestones',
  scope_requests: 'scope_change_requests',
  workitems: 'workitems'
};

const serializeDoc = (doc: any) => {
  if (!doc) return doc;
  const next = { ...doc };
  if (next._id && typeof next._id === 'object' && typeof next._id.toString === 'function') {
    next._id = String(next._id);
  }
  return next;
};

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserFromCookies();
    if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    if (!(await isAdminOrCmo(authUser))) return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });

    const exportSecret = process.env.ADMIN_EXPORT_SECRET || '';
    if (exportSecret) {
      const headerSecret = request.headers.get('X-Admin-Export-Secret') || '';
      if (!headerSecret || headerSecret !== exportSecret) {
        return NextResponse.json({ error: 'Forbidden', code: 'EXPORT_SECRET_REQUIRED' }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include');
    const includeList = include
      ? include.split(',').map((v) => v.trim()).filter(Boolean)
      : DEFAULT_INCLUDE;

    const db = await getDb();
    const collections: Record<string, any[]> = {};
    const counts: Record<string, number> = {};

    for (const key of includeList) {
      const normalized = key.replace('-', '_');
      const collectionName = COLLECTION_MAP[normalized] || COLLECTION_MAP[key];
      if (!collectionName) continue;
      const docs = await db.collection(collectionName).find({}).toArray();
      const serialized = docs.map(serializeDoc);
      collections[collectionName] = serialized;
      counts[collectionName] = serialized.length;
    }

    const bundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: String(authUser.userId || authUser.id || ''),
      environment: process.env.DEPLOY_ENV || process.env.NODE_ENV || undefined,
      collections,
      counts,
      checksum: ''
    };

    const checksum = createHash('sha256')
      .update(JSON.stringify({ ...bundle, checksum: '' }))
      .digest('hex');
    bundle.checksum = checksum;

    await emitEvent({
      ts: new Date().toISOString(),
      type: 'admin.backup.exported',
      actor: { userId: String(authUser.userId || authUser.id || ''), displayName: authUser.email || authUser.userId || authUser.id || 'Admin' },
      resource: { type: 'admin.backup', id: checksum, title: 'Backup Export' },
      payload: { counts, include: includeList }
    });

    return NextResponse.json(bundle);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to export backup' }, { status: 500 });
  }
}

