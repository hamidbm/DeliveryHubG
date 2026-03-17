import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { emitEvent } from '../../../../../shared/events/emitEvent';
import { isAdminOrCmo } from '../../../../../services/authz';
import { requireStandardUser } from '../../../../../shared/auth/guards';
import {
  findBackupCollectionRecord,
  insertBackupCollectionRecord,
  updateBackupCollectionRecord
} from '../../../../../server/db/repositories/adminBackupRepo';

type BackupBundleV1 = {
  version: 1;
  exportedAt: string;
  exportedBy: string;
  environment?: string;
  collections: Record<string, any[]>;
  counts: Record<string, number>;
  checksum?: string;
};

const normalizeCollectionKey = (key: string) => key.replace('-', '_');

const ensureObjectId = (value: string) => {
  if (ObjectId.isValid(value)) return new ObjectId(value);
  return value;
};

const normalizeDoc = (doc: any) => {
  if (!doc) return doc;
  const next = { ...doc };
  if (next._id && typeof next._id === 'string') {
    next._id = ensureObjectId(next._id);
  }
  return next;
};

const resolveMatchFilter = (collection: string, doc: any) => {
  if (collection === 'delivery_policies' || collection === 'notification_settings') {
    return { _id: doc._id || 'global' };
  }
  if (collection === 'delivery_policy_overrides') {
    return { bundleId: String(doc.bundleId || '') };
  }
  if (collection === 'notification_user_prefs') {
    return { userId: String(doc.userId || '') };
  }
  if (collection === 'bundle_assignments') {
    return {
      bundleId: String(doc.bundleId || ''),
      userId: String(doc.userId || ''),
      assignmentType: String(doc.assignmentType || '')
    };
  }
  if (collection === 'bundles') {
    if (doc._id) return { _id: doc._id };
    if (doc.id) return { id: doc.id };
    if (doc.key) return { key: doc.key };
  }
  if (collection === 'milestones') {
    if (doc._id) return { _id: doc._id };
    if (doc.id) return { id: doc.id };
    if (doc.name) return { name: doc.name };
  }
  if (collection === 'scope_change_requests') {
    if (doc._id) return { _id: doc._id };
  }
  if (collection === 'workitems') {
    if (doc._id) return { _id: doc._id };
    if (doc.key) return { key: doc.key };
    if (doc.id) return { id: doc.id };
  }
  return doc._id ? { _id: doc._id } : null;
};

const summarizeDiff = (existing: any, incoming: any) => {
  if (!existing) return { changed: true };
  const a = JSON.stringify(existing);
  const b = JSON.stringify(incoming);
  return { changed: a !== b };
};

export async function POST(request: Request) {
  const auth = await requireStandardUser(request);
  if (!auth.ok) return auth.response;
  const authUser = { userId: auth.principal.userId, role: auth.principal.role || undefined, email: auth.principal.email, id: auth.principal.userId };
  if (!(await isAdminOrCmo(authUser))) return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const bundle = body?.bundle as BackupBundleV1 | undefined;
  const mode = body?.mode === 'APPLY' ? 'APPLY' : 'DRY_RUN';
  const options = body?.options || {};
  const allowUpsert = options.allowUpsert !== false;
  const overwritePolicies = options.overwritePolicies === true;
  const overwriteOverrides = options.overwriteOverrides === true;
  const confirmationPhrase = body?.confirmation?.phrase;

  if (!bundle || bundle.version !== 1) {
    return NextResponse.json({ error: 'Invalid backup bundle', code: 'INVALID_BUNDLE' }, { status: 400 });
  }

  if (mode === 'APPLY' && confirmationPhrase !== 'IMPORT_BACKUP') {
    return NextResponse.json({ error: 'Confirmation required', code: 'CONFIRMATION_REQUIRED' }, { status: 409 });
  }

  const collections = bundle.collections || {};
  const result: any = {
    mode,
    collections: {},
    errors: [] as string[]
  };

  const now = new Date().toISOString();
  await emitEvent({
    ts: now,
    type: 'admin.backup.started',
    actor: { userId: String(authUser.userId || authUser.id || ''), displayName: authUser.email || authUser.userId || authUser.id || 'Admin' },
    resource: { type: 'admin.backup', id: bundle.checksum || bundle.exportedAt, title: 'Backup Import' },
    payload: { mode }
  });

  try {
    for (const [collectionKey, docsRaw] of Object.entries(collections)) {
      const collection = normalizeCollectionKey(collectionKey);
      const docs = Array.isArray(docsRaw) ? docsRaw : [];
      const summary = { collection, creates: 0, upserts: 0, skipped: 0, diffs: [] as any[] };

      for (const rawDoc of docs) {
        const normalized = normalizeDoc(rawDoc);
        const filter = resolveMatchFilter(collection, normalized);
        if (!filter) {
          summary.skipped += 1;
          continue;
        }

        const existing = await findBackupCollectionRecord(collection, filter as any);
        if (collection === 'delivery_policies' && existing && !overwritePolicies) {
          summary.skipped += 1;
          continue;
        }
        if (collection === 'delivery_policy_overrides' && existing && !overwriteOverrides) {
          summary.skipped += 1;
          continue;
        }

        const diff = summarizeDiff(existing, normalized);
        if (diff.changed && (collection === 'delivery_policies' || collection === 'delivery_policy_overrides')) {
          summary.diffs.push({ key: filter, changed: true });
        }

        if (mode === 'DRY_RUN') {
          if (existing) summary.upserts += 1;
          else summary.creates += 1;
          continue;
        }

        if (existing && !allowUpsert) {
          summary.skipped += 1;
          continue;
        }

        if (existing) {
          await updateBackupCollectionRecord(collection, filter as any, normalized, allowUpsert);
          summary.upserts += 1;
        } else {
          await insertBackupCollectionRecord(collection, normalized as any);
          summary.creates += 1;
        }
      }

      result.collections[collection] = summary;
    }

    await emitEvent({
      ts: new Date().toISOString(),
      type: 'admin.backup.completed',
      actor: { userId: String(authUser.userId || authUser.id || ''), displayName: authUser.email || authUser.userId || authUser.id || 'Admin' },
      resource: { type: 'admin.backup', id: bundle.checksum || bundle.exportedAt, title: 'Backup Import' },
      payload: { mode, collections: Object.keys(result.collections) }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    await emitEvent({
      ts: new Date().toISOString(),
      type: 'admin.backup.failed',
      actor: { userId: String(authUser.userId || authUser.id || ''), displayName: authUser.email || authUser.userId || authUser.id || 'Admin' },
      resource: { type: 'admin.backup', id: bundle.checksum || bundle.exportedAt, title: 'Backup Import' },
      payload: { error: error.message || String(error) }
    });
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 });
  }
}
