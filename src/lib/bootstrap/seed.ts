import fs from 'fs';
import os from 'os';
import path from 'path';
import { EJSON } from 'bson';
import { getDb } from '../../services/db';

export const BASELINE_VERSION = '1.0.0';
export const SAMPLE_VERSION = '1.0.0';

const LOCK_TTL_MS = 5 * 60 * 1000;
const BOOTSTRAP_ID = 'bootstrap';

const BASELINE_DIR = path.join(process.cwd(), 'seed', 'baseline');
const SAMPLE_DIR = path.join(process.cwd(), 'seed', 'sample');

const BASELINE_FILES: Array<{ file: string; collection: string; required?: boolean }> = [
  { file: 'taxonomy_categories.json', collection: 'taxonomy_categories', required: true },
  { file: 'taxonomy_document_types.json', collection: 'taxonomy_document_types', required: true },
  { file: 'wiki_themes.json', collection: 'wiki_themes', required: true },
  { file: 'wiki_templates.json', collection: 'wiki_templates', required: true },
  { file: 'diagram_templates.json', collection: 'diagram_templates', required: true },
  { file: 'bundles.json', collection: 'bundles', required: true },
  { file: 'applications.json', collection: 'applications' },
  { file: 'ai_settings.json', collection: 'ai_settings' }
];

const SAMPLE_FILES: Array<{ file: string; collection: string }> = [
  { file: 'users.json', collection: 'users' },
  { file: 'bundle_assignments.json', collection: 'bundle_assignments' },
  { file: 'architecture_diagrams.json', collection: 'architecture_diagrams' },
  { file: 'wiki_pages.json', collection: 'wiki_pages' },
  { file: 'workitems.json', collection: 'workitems' },
  { file: 'reviews.json', collection: 'reviews' },
  { file: 'comment_threads.json', collection: 'comment_threads' },
  { file: 'comment_messages.json', collection: 'comment_messages' }
];

type Tier = 'baseline' | 'sample';

const readSeedFile = (dir: string, file: string) => {
  const fullPath = path.join(dir, file);
  if (!fs.existsSync(fullPath)) return null;
  const raw = fs.readFileSync(fullPath, 'utf8');
  let data: any;
  try {
    data = EJSON.parse(raw);
  } catch {
    data = JSON.parse(raw);
  }
  return Array.isArray(data) ? data : [];
};

const ensureBootstrapDoc = async (db: any) => {
  await db.collection('system_bootstrap').updateOne(
    { _id: BOOTSTRAP_ID },
    {
      $setOnInsert: {
        _id: BOOTSTRAP_ID,
        baseline: { version: '', status: 'failed' },
        sample: { version: '', status: 'failed' },
        locks: {}
      }
    },
    { upsert: true }
  );
};

const getBootstrapDoc = async (db: any) => {
  return await db.collection('system_bootstrap').findOne({ _id: BOOTSTRAP_ID });
};

const debugLog = (...args: any[]) => {
  if (process.env.DEBUG_BOOTSTRAP === 'true') {
    console.log('[bootstrap]', ...args);
  }
};

const isForce = () => process.env.BOOTSTRAP_FORCE === 'true';

const maybeForceUnlock = async (db: any, tier: Tier) => {
  if (!isForce()) return;
  const lockPath = `locks.${tier}`;
  await db.collection('system_bootstrap').updateOne(
    { _id: BOOTSTRAP_ID },
    { $unset: { [lockPath]: '' } }
  );
};

const acquireLock = async (db: any, tier: Tier) => {
  const owner = `${os.hostname()}-${process.pid}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);
  const lockPath = `locks.${tier}`;

  if (process.env.DEBUG_BOOTSTRAP === 'true') {
    const current = await getBootstrapDoc(db);
    debugLog('force', isForce(), 'tier', tier, 'currentLock', current?.locks?.[tier] || null);
  }

  const filter = isForce()
    ? { _id: BOOTSTRAP_ID }
    : {
        _id: BOOTSTRAP_ID,
        $or: [
          { [lockPath]: { $exists: false } },
          { [`${lockPath}.expiresAt`]: { $lte: now } }
        ]
      };

  await db.collection('system_bootstrap').updateOne(
    filter,
    { $set: { [lockPath]: { owner, expiresAt } } },
    { upsert: true }
  );

  const updated = await getBootstrapDoc(db);
  const lock = updated?.locks?.[tier];
  debugLog('lockResult', lock || null, 'owner', owner);
  if (!lock || lock.owner !== owner) return { ok: false, owner };
  return { ok: true, owner };
};

const releaseLock = async (db: any, tier: Tier, owner: string) => {
  const lockPath = `locks.${tier}`;
  await db.collection('system_bootstrap').updateOne(
    { _id: BOOTSTRAP_ID, [`${lockPath}.owner`]: owner },
    { $unset: { [lockPath]: '' } }
  );
};

const setTierStatus = async (db: any, tier: Tier, payload: any) => {
  await db.collection('system_bootstrap').updateOne(
    { _id: BOOTSTRAP_ID },
    { $set: { [tier]: payload } }
  );
};

const getBaselineFilter = (collection: string, doc: any) => {
  if (collection === 'taxonomy_categories') return doc.key ? { key: doc.key } : { name: doc.name };
  if (collection === 'taxonomy_document_types') return { key: doc.key };
  if (collection === 'wiki_themes') return { key: doc.key };
  if (collection === 'wiki_templates') {
    if (doc.key) return { key: doc.key };
    return { name: doc.name, documentTypeId: doc.documentTypeId };
  }
  if (collection === 'diagram_templates') return { key: doc.key };
  if (collection === 'applications') {
    if (doc.aid) return { aid: doc.aid };
    if (doc.key) return { key: doc.key };
    return { name: doc.name, bundleId: doc.bundleId };
  }
  if (collection === 'ai_settings') return { key: doc.key || 'ai_settings' };
  if (collection === 'settings') return doc.key ? { key: doc.key } : { _id: doc._id };
  if (collection === 'bundles') return { name: doc.name };
  return doc._id ? { _id: doc._id } : { name: doc.name };
};

const upsertBaselineDocs = async (db: any, collection: string, docs: any[]) => {
  if (!docs.length) return;
  const ops = docs.map((doc) => ({
    updateOne: {
      filter: getBaselineFilter(collection, doc),
      update: { $setOnInsert: doc },
      upsert: true
    }
  }));
  await db.collection(collection).bulkWrite(ops, { ordered: false });
};

const upsertSampleDocs = async (db: any, collection: string, docs: any[], demoTag: string) => {
  if (!docs.length) return;
  const ops = docs.map((doc, index) => {
    const { _id, ...rest } = doc || {};
    const seedKey = doc?._seedKey || `${collection}:${index}`;
    const filter = _id
      ? { _id }
      : doc?.key
        ? { key: doc.key }
        : doc?.email
          ? { email: doc.email }
          : doc?.name
            ? { name: doc.name }
            : { _seedKey: seedKey };
    return {
      updateOne: {
        filter,
        update: { $set: { ...rest, _seedKey: seedKey, demoTag } },
        upsert: true
      }
    };
  });
  await db.collection(collection).bulkWrite(ops, { ordered: false });
};

const buildSampleLookup = async (db: any) => {
  const [bundles, applications, docTypes, spaces, users] = await Promise.all([
    db.collection('bundles').find({}).toArray(),
    db.collection('applications').find({}).toArray(),
    db.collection('taxonomy_document_types').find({}).toArray(),
    db.collection('wiki_spaces').find({}).toArray(),
    db.collection('users').find({}).toArray()
  ]);

  const bundleByName = new Map<string, any>();
  const bundleByKey = new Map<string, any>();
  bundles.forEach((b: any) => {
    if (b.name) bundleByName.set(String(b.name), b);
    if (b.key) bundleByKey.set(String(b.key), b);
  });

  const appByAid = new Map<string, any>();
  const appByName = new Map<string, any>();
  applications.forEach((a: any) => {
    if (a.aid) appByAid.set(String(a.aid), a);
    if (a.name) appByName.set(String(a.name), a);
  });

  const docTypeByKey = new Map<string, any>();
  const docTypeByName = new Map<string, any>();
  docTypes.forEach((d: any) => {
    if (d.key) docTypeByKey.set(String(d.key), d);
    if (d.name) docTypeByName.set(String(d.name), d);
  });

  const spaceByName = new Map<string, any>();
  spaces.forEach((s: any) => {
    if (s.name) spaceByName.set(String(s.name), s);
  });

  const userByEmail = new Map<string, any>();
  users.forEach((u: any) => {
    if (u.email) userByEmail.set(String(u.email).toLowerCase(), u);
  });

  return { bundleByName, bundleByKey, appByAid, appByName, docTypeByKey, docTypeByName, spaceByName, userByEmail };
};

const resolveSampleRefs = async (db: any, collection: string, doc: any, lookup: any) => {
  if (!doc) return doc;
  const refs = doc._refs || {};
  const resolved = { ...doc };
  delete resolved._refs;

  const resolveBundle = () => {
    if (refs.bundleKey && lookup.bundleByKey.has(refs.bundleKey)) return lookup.bundleByKey.get(refs.bundleKey);
    if (refs.bundleName && lookup.bundleByName.has(refs.bundleName)) return lookup.bundleByName.get(refs.bundleName);
    return null;
  };
  const resolveApp = () => {
    if (refs.appAid && lookup.appByAid.has(refs.appAid)) return lookup.appByAid.get(refs.appAid);
    if (refs.appName && lookup.appByName.has(refs.appName)) return lookup.appByName.get(refs.appName);
    return null;
  };
  const resolveDocType = () => {
    if (refs.documentTypeKey && lookup.docTypeByKey.has(refs.documentTypeKey)) return lookup.docTypeByKey.get(refs.documentTypeKey);
    if (refs.documentTypeName && lookup.docTypeByName.has(refs.documentTypeName)) return lookup.docTypeByName.get(refs.documentTypeName);
    return null;
  };
  const resolveSpace = () => {
    if (refs.spaceName && lookup.spaceByName.has(refs.spaceName)) return lookup.spaceByName.get(refs.spaceName);
    return null;
  };
  const resolveUser = (email?: string) => {
    if (!email) return null;
    return lookup.userByEmail.get(String(email).toLowerCase()) || null;
  };

  const bundle = resolveBundle();
  const app = resolveApp();
  const docType = resolveDocType();
  const space = resolveSpace();

  if (bundle && !resolved.bundleId) resolved.bundleId = String(bundle._id);
  if (app && !resolved.applicationId) resolved.applicationId = String(app._id);
  if (docType && !resolved.documentTypeId) resolved.documentTypeId = String(docType._id);
  if (space && !resolved.spaceId) resolved.spaceId = String(space._id);

  if (collection === 'bundle_assignments') {
    if (bundle) resolved.bundleId = String(bundle._id);
    if (refs.userEmail) {
      const user = resolveUser(refs.userEmail);
      if (user) resolved.userId = String(user._id);
    }
  }

  if (collection === 'wiki_pages') {
    if (refs.authorEmail) {
      const user = resolveUser(refs.authorEmail);
      if (user) resolved.author = user.name || user.email;
    }
    if (refs.lastModifiedByEmail) {
      const user = resolveUser(refs.lastModifiedByEmail);
      if (user) resolved.lastModifiedBy = user.name || user.email;
    }
  }

  if (collection === 'workitems') {
    if (refs.assigneeEmails?.length) {
      const assignees = refs.assigneeEmails.map((e: string) => resolveUser(e)).filter(Boolean).map((u: any) => String(u._id));
      if (assignees.length) resolved.assigneeUserIds = assignees;
    }
    if (refs.watcherEmails?.length) {
      const watchers = refs.watcherEmails.map((e: string) => resolveUser(e)).filter(Boolean).map((u: any) => String(u._id));
      if (watchers.length) resolved.watcherUserIds = watchers;
    }
    if (refs.createdByEmail) {
      const user = resolveUser(refs.createdByEmail);
      if (user) resolved.createdBy = user.name || user.email;
    }
    if (refs.updatedByEmail) {
      const user = resolveUser(refs.updatedByEmail);
      if (user) resolved.updatedBy = user.name || user.email;
    }
    if (refs.parentKey) {
      const parent = await db.collection('workitems').findOne({ key: refs.parentKey });
      if (parent?._id) resolved.parentId = String(parent._id);
    }

    if (!resolved.parentId && String(doc.type || '').toUpperCase() === 'FEATURE' && resolved.bundleId) {
      const epic = await db.collection('workitems').findOne({ bundleId: resolved.bundleId, type: 'EPIC' });
      if (epic?._id) resolved.parentId = String(epic._id);
    }

    if (doc._refsLinkedDiagram?.diagramSeedKey) {
      const diagram = await db.collection('architecture_diagrams').findOne({ _seedKey: doc._refsLinkedDiagram.diagramSeedKey });
      if (diagram?._id) {
        resolved.linkedResource = { type: 'architecture_diagram', id: String(diagram._id), title: diagram.title };
      }
      delete resolved._refsLinkedDiagram;
    }

    if (doc._refsLinkedWiki?.wikiPageSeedKey) {
      const page = await db.collection('wiki_pages').findOne({ _seedKey: doc._refsLinkedWiki.wikiPageSeedKey });
      if (page?._id) {
        resolved.linkedResource = { type: 'wiki_page', id: String(page._id), title: page.title };
      }
      delete resolved._refsLinkedWiki;
    }
  }

  if (collection === 'architecture_diagrams') {
    if (refs.createdByEmail) {
      const user = resolveUser(refs.createdByEmail);
      if (user) resolved.createdBy = user.name || user.email;
    }
    if (refs.updatedByEmail) {
      const user = resolveUser(refs.updatedByEmail);
      if (user) resolved.updatedBy = user.name || user.email;
    }
  }

  if (collection === 'reviews') {
    if (refs.diagramSeedKey) {
      const diagram = await db.collection('architecture_diagrams').findOne({ _seedKey: refs.diagramSeedKey });
      if (diagram?._id) {
        resolved.resource = {
          ...(resolved.resource || {}),
          type: 'architecture_diagram',
          id: String(diagram._id),
          title: diagram.title
        };
      }
    }
    if (refs.wikiPageSeedKey) {
      const page = await db.collection('wiki_pages').findOne({ _seedKey: refs.wikiPageSeedKey });
      if (page?._id) {
        resolved.resource = {
          ...(resolved.resource || {}),
          type: 'wiki_page',
          id: String(page._id),
          title: page.title
        };
      }
    }
    if (refs.workitemSeedKey) {
      const item = await db.collection('workitems').findOne({ _seedKey: refs.workitemSeedKey });
      if (item?._id) {
        resolved.resource = {
          ...(resolved.resource || {}),
          type: 'workitem',
          id: String(item._id),
          title: item.title
        };
      }
    }
    if (refs.requestedByEmail) {
      const user = resolveUser(refs.requestedByEmail);
      if (user) {
        resolved.createdBy = { userId: String(user._id), displayName: user.name, email: user.email };
      }
    }
    if (Array.isArray(resolved.cycles)) {
      resolved.cycles = resolved.cycles.map((cycle: any) => {
        const next = { ...cycle };
        if (cycle.requestedByEmail) {
          const user = resolveUser(cycle.requestedByEmail);
          if (user) next.requestedBy = { userId: String(user._id), displayName: user.name, email: user.email };
        }
        if (cycle.reviewersEmails) {
          const reviewers = cycle.reviewersEmails
            .map((e: string) => resolveUser(e))
            .filter(Boolean)
            .map((u: any) => ({ userId: String(u._id), displayName: u.name, email: u.email }));
          next.reviewers = reviewers;
          next.reviewerUserIds = reviewers.map((r: any) => r.userId);
        }
        if (cycle.feedbackSentByEmail) {
          const user = resolveUser(cycle.feedbackSentByEmail);
          if (user) next.feedbackSentBy = { userId: String(user._id), displayName: user.name, email: user.email };
        }
        if (cycle.vendorResponseByEmail) {
          const user = resolveUser(cycle.vendorResponseByEmail);
          if (user) next.vendorResponse = { ...(next.vendorResponse || {}), submittedBy: { userId: String(user._id), displayName: user.name, email: user.email } };
        }
        delete next.requestedByEmail;
        delete next.reviewersEmails;
        delete next.feedbackSentByEmail;
        delete next.vendorResponseByEmail;
        return next;
      });
    }
  }

  if (collection === 'comment_threads') {
    if (refs.reviewSeedKey) {
      const review = await db.collection('reviews').findOne({ _seedKey: refs.reviewSeedKey });
      if (review?._id) {
        resolved.reviewId = String(review._id);
        resolved.reviewCycleId = review.currentCycleId || resolved.reviewCycleId;
        resolved.resource = review.resource;
      }
    }
    if (refs.participantEmails?.length) {
      const participants = refs.participantEmails
        .map((e: string) => resolveUser(e))
        .filter(Boolean)
        .map((u: any) => String(u._id));
      resolved.participants = participants;
    }
  }

  if (collection === 'comment_messages') {
    if (refs.threadSeedKey) {
      const thread = await db.collection('comment_threads').findOne({ _seedKey: refs.threadSeedKey });
      if (thread?._id) resolved.threadId = String(thread._id);
    }
    if (refs.authorEmail) {
      const user = resolveUser(refs.authorEmail);
      if (user) resolved.author = { userId: String(user._id), displayName: user.name, email: user.email };
    }
  }

  return resolved;
};

const seedBundlesAndApps = async (db: any, bundleDocs: any[]) => {
  if (!bundleDocs.length) return;

  for (const raw of bundleDocs) {
    const { apps, ...bundleDoc } = raw || {};
    const bundlePayload = { ...bundleDoc };
    await upsertBaselineDocs(db, 'bundles', [bundlePayload]);

    if (bundleDoc?.name) {
      const spaceName = `${bundleDoc.name} Space`;
      await db.collection('wiki_spaces').updateOne(
        { name: spaceName },
        {
          $setOnInsert: {
            name: spaceName,
            description: `Workspace for ${bundleDoc.name}`,
            createdAt: new Date().toISOString()
          }
        },
        { upsert: true }
      );
    }

    const storedBundle = await db.collection('bundles').findOne({ name: bundleDoc.name });
    const bundleId = storedBundle?._id ? String(storedBundle._id) : bundleDoc._id ? String(bundleDoc._id) : undefined;

    if (bundleDoc?.name) {
      const rawKey = String(bundleDoc.key || bundleDoc.name);
      const safeKey = rawKey.replace(/[^a-zA-Z0-9]+/g, '').toUpperCase() || 'BUNDLE';
      const epicKey = `${safeKey}-EPIC`;
      const epicTitle = `${bundleDoc.name} Epic`;

      await db.collection('workitems').updateOne(
        { type: 'EPIC', key: epicKey, bundleId },
        {
          $setOnInsert: {
            key: epicKey,
            title: epicTitle,
            description: `Baseline epic for ${bundleDoc.name}.`,
            type: 'EPIC',
            status: 'TODO',
            bundleId,
            scopeRef: { type: 'bundle', id: bundleId },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'system',
            updatedBy: 'system'
          }
        },
        { upsert: true }
      );
    }

    if (Array.isArray(apps) && apps.length) {
      const appDocs = apps.map((app: any) => ({
        ...app,
        bundleId,
        createdAt: app.createdAt || new Date().toISOString()
      }));

      const ops = appDocs.map((doc: any) => {
        const filter = doc.aid
          ? { aid: doc.aid }
          : doc.key
            ? { key: doc.key }
            : { name: doc.name, bundleId: doc.bundleId };
        return {
          updateOne: {
            filter,
            update: { $setOnInsert: doc },
            upsert: true
          }
        };
      });
      if (ops.length) await db.collection('applications').bulkWrite(ops, { ordered: false });
    }
  }
};

const ensureBundleEpics = async (db: any) => {
  const bundles = await db.collection('bundles').find({}).toArray();
  for (const bundle of bundles) {
    const rawKey = String(bundle.key || bundle.name || 'BUNDLE');
    const safeKey = rawKey.replace(/[^a-zA-Z0-9]+/g, '').toUpperCase() || 'BUNDLE';
    const epicKey = `${safeKey}-EPIC`;
    const epicTitle = `${bundle.name} Epic`;
    const bundleId = String(bundle._id);
    await db.collection('workitems').updateOne(
      { type: 'EPIC', key: epicKey, bundleId },
      {
        $setOnInsert: {
          key: epicKey,
          title: epicTitle,
          description: `Baseline epic for ${bundle.name}.`,
          type: 'EPIC',
          status: 'TODO',
          bundleId,
          scopeRef: { type: 'bundle', id: bundleId },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system',
          updatedBy: 'system'
        }
      },
      { upsert: true }
    );
  }
};

const loadBaselineFiles = () => {
  return BASELINE_FILES.map((entry) => {
    const docs = readSeedFile(BASELINE_DIR, entry.file);
    if (docs === null && entry.required) {
      throw new Error(`Missing required baseline file: ${entry.file}`);
    }
    return { ...entry, docs: docs || [] };
  });
};

let aiSecretNoticeLogged = false;

const applyAiSecretOverrides = (doc: any) => {
  if (!doc) return doc;
  const next = { ...doc };

  const envOpenai = process.env.OPENAI_API_KEY;
  const envOpenRouter = process.env.OPENROUTER_API_KEY;
  const envGemini = process.env.GEMINI_API_KEY;
  const envAnthropic = process.env.ANTHROPIC_API_KEY;
  const envHugging = process.env.HUGGINGFACE_API_KEY;
  const envCohere = process.env.COHERE_API_KEY;

  if (!aiSecretNoticeLogged) {
    const missing = [
      !envOpenai && 'OPENAI_API_KEY',
      !envOpenRouter && 'OPENROUTER_API_KEY',
      !envGemini && 'GEMINI_API_KEY',
      !envAnthropic && 'ANTHROPIC_API_KEY',
      !envHugging && 'HUGGINGFACE_API_KEY',
      !envCohere && 'COHERE_API_KEY'
    ].filter(Boolean);
    if (missing.length) {
      console.info(`[bootstrap] AI keys not provided: ${missing.join(', ')}. Providers will remain unconfigured until set via env or Admin.`);
    }
    aiSecretNoticeLogged = true;
  }

  return next;
};

const loadSampleFiles = (collections?: string[]) => {
  const filter = collections?.length ? new Set(collections) : null;
  return SAMPLE_FILES.filter((entry) => !filter || filter.has(entry.collection)).map((entry) => {
    const docs = readSeedFile(SAMPLE_DIR, entry.file);
    return { ...entry, docs: docs || [] };
  });
};

export const runBaselineBootstrap = async (installedBy = 'system') => {
  const db = await getDb();
  await ensureBootstrapDoc(db);

  const current = await getBootstrapDoc(db);
  if (!isForce() && current?.baseline?.version === BASELINE_VERSION && current?.baseline?.status === 'installed') {
    return { skipped: true, reason: 'already-installed' };
  }

  debugLog('baseline status', current?.baseline || null);
  await maybeForceUnlock(db, 'baseline');
  const lock = await acquireLock(db, 'baseline');
  if (!lock.ok) return { skipped: true, reason: 'locked' };

  try {
    await setTierStatus(db, 'baseline', {
      version: BASELINE_VERSION,
      status: 'installing',
      installedAt: new Date(),
      installedBy
    });

    const files = loadBaselineFiles();
    for (const entry of files) {
      if (entry.collection === 'bundles') {
        await seedBundlesAndApps(db, entry.docs);
        continue;
      }
      if (entry.collection === 'ai_settings') {
        const docs = entry.docs.map(applyAiSecretOverrides);
        await upsertBaselineDocs(db, entry.collection, docs);
        continue;
      }
      await upsertBaselineDocs(db, entry.collection, entry.docs);
    }

    await setTierStatus(db, 'baseline', {
      version: BASELINE_VERSION,
      status: 'installed',
      installedAt: new Date(),
      installedBy
    });
    return { skipped: false };
  } catch (error) {
    await setTierStatus(db, 'baseline', {
      version: BASELINE_VERSION,
      status: 'failed',
      installedAt: new Date(),
      installedBy
    });
    throw error;
  } finally {
    await releaseLock(db, 'baseline', lock.owner);
  }
};

export const runSampleBootstrap = async (installedBy = 'system', collections?: string[]) => {
  const db = await getDb();
  await ensureBootstrapDoc(db);

  const current = await getBootstrapDoc(db);
  if (!isForce() && current?.sample?.version === SAMPLE_VERSION && current?.sample?.status === 'installed') {
    return { skipped: true, reason: 'already-installed' };
  }

  await maybeForceUnlock(db, 'sample');
  const lock = await acquireLock(db, 'sample');
  if (!lock.ok) return { skipped: true, reason: 'locked' };

  try {
    await ensureBundleEpics(db);
    await setTierStatus(db, 'sample', {
      version: SAMPLE_VERSION,
      status: 'installing',
      installedAt: new Date(),
      installedBy
    });

    const demoTag = 'sample-v1';
    const files = loadSampleFiles(collections);
    const lookup = await buildSampleLookup(db);
    for (const entry of files) {
      if (entry.collection === 'workitems') {
        const docs = entry.docs || [];
        const byType = (type) => docs.filter((d) => String(d.type || '').toUpperCase() === type);
        const orderedBatches = [
          byType('FEATURE'),
          byType('STORY'),
          byType('TASK'),
          byType('RISK'),
          byType('DEPENDENCY'),
          docs.filter((d) => !['FEATURE', 'STORY', 'TASK', 'RISK', 'DEPENDENCY', 'EPIC'].includes(String(d.type || '').toUpperCase()))
        ];
        for (const batch of orderedBatches) {
          if (!batch.length) continue;
          const resolved = [];
          for (const doc of batch) {
            resolved.push(await resolveSampleRefs(db, entry.collection, doc, lookup));
          }
          await upsertSampleDocs(db, entry.collection, resolved, demoTag);
        }
        continue;
      }

      const resolvedDocs = [];
      for (const doc of entry.docs) {
        resolvedDocs.push(await resolveSampleRefs(db, entry.collection, doc, lookup));
      }
      await upsertSampleDocs(db, entry.collection, resolvedDocs, demoTag);
    }

    await setTierStatus(db, 'sample', {
      version: SAMPLE_VERSION,
      status: 'installed',
      installedAt: new Date(),
      installedBy
    });
    return { skipped: false };
  } catch (error) {
    await setTierStatus(db, 'sample', {
      version: SAMPLE_VERSION,
      status: 'failed',
      installedAt: new Date(),
      installedBy
    });
    throw error;
  } finally {
    await releaseLock(db, 'sample', lock.owner);
  }
};

export const resetSampleData = async (installedBy = 'system') => {
  const db = await getDb();
  await ensureBootstrapDoc(db);
  const demoTag = 'sample-v1';
  for (const entry of SAMPLE_FILES) {
    await db.collection(entry.collection).deleteMany({ demoTag });
  }

  await setTierStatus(db, 'sample', {
    version: SAMPLE_VERSION,
    status: 'not_installed',
    installedAt: new Date(),
    installedBy
  });
};

export const getSampleCollections = () => {
  return SAMPLE_FILES.map((entry) => entry.collection);
};

export const getSampleStatus = async () => {
  const db = await getDb();
  await ensureBootstrapDoc(db);
  const doc = await getBootstrapDoc(db);
  return doc?.sample || null;
};
