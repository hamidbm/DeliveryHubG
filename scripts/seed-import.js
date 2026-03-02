/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');

const DEFAULT_DB = null;
const SEED_DIR = process.env.SEED_DIR || path.join(process.cwd(), 'seed', 'collections');

const readCollectionFile = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const docs = EJSON.parse(raw);
  return Array.isArray(docs) ? docs : [];
};

const listSeedFiles = () => {
  if (!fs.existsSync(SEED_DIR)) return [];
  return fs.readdirSync(SEED_DIR).filter((f) => f.endsWith('.json'));
};

const importSeed = async () => {
  const uri = process.env.MONGO_URL || process.env.MONGO_PUBLIC_URL || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Missing MONGO_URL or MONGODB_URI for import');
  }

  const files = listSeedFiles();
  if (!files.length) {
    console.log(`No seed files found in ${SEED_DIR}`);
    return;
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  for (const file of files) {
    const name = path.basename(file, '.json');
    const docs = readCollectionFile(path.join(SEED_DIR, file));
    if (!docs.length) {
      console.log(`Skipped ${name} (0 docs)`);
      continue;
    }

    const collection = db.collection(name);
    const ops = [];
    for (const doc of docs) {
      if (doc && doc._id) {
        ops.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: doc },
            upsert: true
          }
        });
      } else {
        ops.push({ insertOne: { document: doc } });
      }
    }

    const result = await collection.bulkWrite(ops, { ordered: false });
    console.log(`Imported ${name}: upserted=${result.upsertedCount} modified=${result.modifiedCount} inserted=${result.insertedCount}`);
  }

  await client.close();
};

importSeed()
  .then(() => {
    console.log('Seed import complete.');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
