import { getDb } from '../src/services/db';

const run = async () => {
  const db = await getDb();
  await db.collection('bundles').createIndex({ visibility: 1 });
  const result = await db.collection('bundles').updateMany(
    { visibility: { $exists: false } },
    { $set: { visibility: 'INTERNAL' } }
  );
  console.log(`[visibility] bundles updated: ${result.modifiedCount}`);
};

if (!process.env.TEST_API_RUNNER) {
  run().catch((err) => {
    console.error('[visibility] migration failed', err);
    process.exit(1);
  });
}
