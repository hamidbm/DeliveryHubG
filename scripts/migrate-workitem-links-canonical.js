/* eslint-disable no-console */
const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Missing MONGODB_URI in environment.');
  process.exit(1);
}

function resolveDbName() {
  if (process.env.MONGODB_DB) return process.env.MONGODB_DB;
  try {
    const parsed = new URL(uri);
    const pathname = parsed.pathname || '';
    const name = pathname.replace(/^\//, '');
    return name || 'deliveryhub';
  } catch {
    return 'deliveryhub';
  }
}

function resolveWorkItemFilter(id, key) {
  if (ObjectId.isValid(id)) return { _id: new ObjectId(id) };
  const clauses = [{ id }];
  if (key) clauses.push({ key });
  return { $or: clauses };
}

async function main() {
  const dbName = resolveDbName();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const cursor = db.collection('workitems').find({ 'links.type': { $in: ['IS_BLOCKED_BY', 'IS_DUPLICATED_BY'] } });

  let scanned = 0;
  let updated = 0;
  let migratedLinks = 0;
  let skipped = 0;

  for await (const item of cursor) {
    scanned += 1;
    const links = Array.isArray(item.links) ? item.links : [];
    let changed = false;
    const nextLinks = [];

    for (const link of links) {
      const type = String(link?.type || '');
      if (type !== 'IS_BLOCKED_BY' && type !== 'IS_DUPLICATED_BY') {
        nextLinks.push(link);
        continue;
      }

      const targetId = String(link?.targetId || '');
      if (!targetId) {
        nextLinks.push(link);
        skipped += 1;
        continue;
      }

      const canonicalType = type === 'IS_BLOCKED_BY' ? 'BLOCKS' : 'DUPLICATES';
      const sourceFilter = resolveWorkItemFilter(targetId, link?.targetKey);
      const source = await db.collection('workitems').findOne(sourceFilter, { projection: { _id: 1, id: 1, key: 1, title: 1, links: 1 } });

      if (!source) {
        nextLinks.push(link);
        skipped += 1;
        continue;
      }

      const targetItemId = String(item._id || item.id || '');
      const existing = (source.links || []).some((l) => String(l?.type) === canonicalType && String(l?.targetId) === targetItemId);
      if (!existing) {
        await db.collection('workitems').updateOne(
          { _id: source._id },
          { $addToSet: { links: { type: canonicalType, targetId: targetItemId, targetKey: item.key, targetTitle: item.title } } }
        );
        migratedLinks += 1;
      }

      changed = true;
    }

    if (changed) {
      await db.collection('workitems').updateOne(
        { _id: item._id },
        { $set: { links: nextLinks } }
      );
      updated += 1;
    }
  }

  console.log(`Scanned ${scanned} work items.`);
  console.log(`Updated ${updated}.`);
  console.log(`Migrated links ${migratedLinks}.`);
  console.log(`Skipped ${skipped}.`);

  await client.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
