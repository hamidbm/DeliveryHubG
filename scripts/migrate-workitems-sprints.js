/* eslint-disable no-console */
const { MongoClient } = require('mongodb');

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

async function main() {
  const dbName = resolveDbName();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const source = db.collection('sprints');
  const target = db.collection('workitems_sprints');

  let total = 0;
  let upserts = 0;
  let replacements = 0;

  const cursor = source.find({});
  for await (const doc of cursor) {
    total += 1;
    const res = await target.replaceOne({ _id: doc._id }, doc, { upsert: true });
    if (res.upsertedCount) upserts += res.upsertedCount;
    if (res.modifiedCount) replacements += res.modifiedCount;
  }

  console.log(`Copied ${total} documents from sprints -> workitems_sprints`);
  console.log(`Upserted: ${upserts}, Replaced: ${replacements}`);

  await client.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
