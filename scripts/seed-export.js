/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const { EJSON } = require('bson');

const DEFAULT_DB = process.env.MONGODB_DB_NAME || 'deliveryhub';
const DEFAULT_BUNDLE_NAMES = ['Bundle 1', 'Bundle 2', 'Bundle 3'];

const OUTPUT_DIR = path.join(process.cwd(), 'seed');
const COLLECTION_DIR = path.join(OUTPUT_DIR, 'collections');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const toId = (value) => String(value || '');

const getBundleNames = () => {
  const env = process.env.SEED_BUNDLE_NAMES;
  if (!env) return DEFAULT_BUNDLE_NAMES;
  return env.split(',').map((n) => n.trim()).filter(Boolean);
};

const writeCollection = (name, docs) => {
  const filePath = path.join(COLLECTION_DIR, `${name}.json`);
  const payload = EJSON.stringify(docs, { relaxed: false, space: 2 });
  fs.writeFileSync(filePath, payload, 'utf8');
  return { name, count: docs.length, file: filePath };
};

const listCollections = async (db) => {
  const items = await db.listCollections().toArray();
  return new Set(items.map((c) => c.name));
};

const exportSeed = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Missing MONGODB_URI for export');
  }

  ensureDir(OUTPUT_DIR);
  ensureDir(COLLECTION_DIR);

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(DEFAULT_DB);
  const available = await listCollections(db);

  const bundleNames = getBundleNames();
  const bundles = await db.collection('bundles').find({ name: { $in: bundleNames } }).toArray();
  const bundleIds = bundles.map((b) => toId(b._id));

  const applications = await db.collection('applications').find({ bundleId: { $in: bundleIds } }).toArray();
  const appIds = applications.map((a) => toId(a._id || a.id));

  const milestones = await db.collection('milestones').find({
    $or: [
      { bundleId: { $in: bundleIds } },
      { applicationId: { $in: appIds } }
    ]
  }).toArray();

  const bundleProfiles = available.has('bundle_profiles')
    ? await db.collection('bundle_profiles').find({ bundleId: { $in: bundleIds } }).toArray()
    : [];

  const bundleAssignments = available.has('bundle_assignments')
    ? await db.collection('bundle_assignments').find({ bundleId: { $in: bundleIds } }).toArray()
    : [];

  const sprints = available.has('sprints')
    ? await db.collection('sprints').find({
        $or: [
          { bundleId: { $in: bundleIds } },
          { applicationId: { $in: appIds } }
        ]
      }).toArray()
    : [];

  const architectureDiagrams = await db.collection('architecture_diagrams').find({
    $or: [
      { bundleId: { $in: bundleIds } },
      { applicationId: { $in: appIds } }
    ]
  }).toArray();
  const diagramIds = architectureDiagrams.map((d) => toId(d._id));

  const wikiPages = await db.collection('wiki_pages').find({
    $or: [
      { bundleId: { $in: bundleIds } },
      { applicationId: { $in: appIds } }
    ]
  }).toArray();
  const wikiPageIds = wikiPages.map((p) => toId(p._id));

  const wikiAssets = await db.collection('wiki_assets').find({
    $or: [
      { bundleId: { $in: bundleIds } },
      { applicationId: { $in: appIds } }
    ]
  }).toArray();
  const wikiAssetIds = wikiAssets.map((a) => toId(a._id));

  const wikiSpaces = available.has('wiki_spaces')
    ? await db.collection('wiki_spaces').find({ _id: { $in: Array.from(new Set(wikiPages.map((p) => p.spaceId).filter(Boolean).map((id) => new ObjectId(String(id))))) } }).toArray()
    : [];

  const wikiThemes = available.has('wiki_themes')
    ? await db.collection('wiki_themes').find({}).toArray()
    : [];

  const wikiHistory = available.has('wiki_history')
    ? await db.collection('wiki_history').find({ pageId: { $in: wikiPageIds } }).toArray()
    : [];

  const workitems = await db.collection('workitems').find({
    $or: [
      { bundleId: { $in: bundleIds } },
      { applicationId: { $in: appIds } },
      { 'scopeRef.type': 'bundle', 'scopeRef.id': { $in: bundleIds } },
      { 'scopeRef.type': 'application', 'scopeRef.id': { $in: appIds } }
    ]
  }).toArray();
  const workitemIds = workitems.map((w) => toId(w._id));

  const workitemAttachments = available.has('workitems_attachments')
    ? await db.collection('workitems_attachments').find({ workItemId: { $in: workitemIds } }).toArray()
    : [];

  const workitemsSprints = available.has('workitems_sprints')
    ? await db.collection('workitems_sprints').find({
        $or: [
          { bundleId: { $in: bundleIds } },
          { applicationId: { $in: appIds } }
        ]
      }).toArray()
    : [];

  const reviewResourceIds = new Set([...diagramIds, ...wikiPageIds, ...wikiAssetIds, ...workitemIds]);
  const reviews = available.has('reviews')
    ? await db.collection('reviews').find({
        $or: [
          { 'resource.bundleId': { $in: bundleIds } },
          { 'resource.id': { $in: Array.from(reviewResourceIds) } }
        ]
      }).toArray()
    : [];
  const reviewIds = reviews.map((r) => toId(r._id));

  const commentThreads = available.has('comment_threads')
    ? await db.collection('comment_threads').find({
        $or: [
          { reviewId: { $in: reviewIds } },
          { 'resource.id': { $in: Array.from(reviewResourceIds) } }
        ]
      }).toArray()
    : [];
  const commentThreadIds = commentThreads.map((t) => toId(t._id));

  const commentMessages = available.has('comment_messages')
    ? await db.collection('comment_messages').find({ threadId: { $in: commentThreadIds } }).toArray()
    : [];

  const feedbackPackages = available.has('feedback_packages')
    ? await db.collection('feedback_packages').find({ 'resource.id': { $in: Array.from(reviewResourceIds) } }).toArray()
    : [];

  const taxonomyCategories = available.has('taxonomy_categories')
    ? await db.collection('taxonomy_categories').find({}).toArray()
    : [];
  const taxonomyDocumentTypes = available.has('taxonomy_document_types')
    ? await db.collection('taxonomy_document_types').find({}).toArray()
    : [];

  const userIds = new Set();
  const addUserId = (value) => {
    if (!value) return;
    userIds.add(String(value));
  };
  bundleAssignments.forEach((a) => addUserId(a.userId));
  reviews.forEach((r) => {
    addUserId(r.createdBy?.userId);
    (r.currentReviewerUserIds || []).forEach(addUserId);
    (r.cycles || []).forEach((c) => {
      (c.reviewers || []).forEach((rv) => addUserId(rv.userId));
      addUserId(c.requestedBy?.userId);
    });
  });
  workitems.forEach((w) => {
    (w.assigneeUserIds || []).forEach(addUserId);
    (w.watcherUserIds || []).forEach(addUserId);
  });
  commentThreads.forEach((t) => (t.participants || []).forEach(addUserId));
  commentMessages.forEach((m) => addUserId(m.author?.userId));

  const users = userIds.size
    ? await db.collection('users').find({ _id: { $in: Array.from(userIds).filter(ObjectId.isValid).map((id) => new ObjectId(id)) } }).toArray()
    : [];

  const manifest = {
    generatedAt: new Date().toISOString(),
    db: DEFAULT_DB,
    bundleNames,
    bundleIds,
    counts: {}
  };

  const outputs = [];
  const pushOutput = (name, docs) => {
    outputs.push(writeCollection(name, docs));
    manifest.counts[name] = docs.length;
  };

  pushOutput('bundles', bundles);
  pushOutput('applications', applications);
  pushOutput('bundle_profiles', bundleProfiles);
  pushOutput('bundle_assignments', bundleAssignments);
  pushOutput('milestones', milestones);
  pushOutput('sprints', sprints);
  pushOutput('architecture_diagrams', architectureDiagrams);
  pushOutput('wiki_pages', wikiPages);
  pushOutput('wiki_assets', wikiAssets);
  pushOutput('wiki_spaces', wikiSpaces);
  pushOutput('wiki_themes', wikiThemes);
  pushOutput('wiki_history', wikiHistory);
  pushOutput('workitems', workitems);
  pushOutput('workitems_attachments', workitemAttachments);
  pushOutput('workitems_sprints', workitemsSprints);
  pushOutput('reviews', reviews);
  pushOutput('comment_threads', commentThreads);
  pushOutput('comment_messages', commentMessages);
  pushOutput('feedback_packages', feedbackPackages);
  pushOutput('taxonomy_categories', taxonomyCategories);
  pushOutput('taxonomy_document_types', taxonomyDocumentTypes);
  pushOutput('users', users);

  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  await client.close();
  return outputs;
};

exportSeed()
  .then((outputs) => {
    outputs.forEach((o) => console.log(`Exported ${o.count} docs -> ${o.name}`));
    console.log('Seed export complete.');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
