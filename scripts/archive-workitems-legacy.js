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

function timestampTag() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

async function main() {
  const dbName = resolveDbName();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const legacyName = 'work_items';
  const legacyExists = await db.listCollections({ name: legacyName }, { nameOnly: true }).hasNext();
  if (!legacyExists) {
    console.log('No legacy work_items collection found. Nothing to archive.');
    await client.close();
    return;
  }

  const legacyCount = await db.collection(legacyName).countDocuments({}, { limit: 1 });
  if (!legacyCount) {
    console.log('Legacy work_items is empty. Nothing to archive.');
    await client.close();
    return;
  }

  const archiveName = `workitems_archive_${timestampTag()}`;
  await db.collection(legacyName).rename(archiveName);
  console.log(`Archived work_items -> ${archiveName}`);

  await client.close();
}

main().catch((err) => {
  console.error('Archive failed:', err);
  process.exit(1);
});
