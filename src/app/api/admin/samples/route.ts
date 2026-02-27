import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import fs from 'fs';
import path from 'path';
import { EJSON } from 'bson';
import { MongoClient } from 'mongodb';
import { isAdmin } from '../../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');
const DEFAULT_DB = process.env.MONGODB_DB_NAME || 'deliveryhub';
const SEED_DIR = process.env.SEED_DIR || path.join(process.cwd(), 'seed', 'collections');
const MANIFEST_PATH = path.join(process.cwd(), 'seed', 'manifest.json');

const getUserId = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return String(payload.id || payload.userId || '');
};

const requireAdmin = async () => {
  const userId = await getUserId();
  if (!userId) return { ok: false, status: 401 };
  const allowed = await isAdmin(userId);
  if (!allowed) return { ok: false, status: 403 };
  return { ok: true, status: 200 };
};

const listSeedFiles = () => {
  if (!fs.existsSync(SEED_DIR)) return [];
  return fs.readdirSync(SEED_DIR).filter((f) => f.endsWith('.json'));
};

const readCollectionFile = (filePath: string) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const docs = EJSON.parse(raw);
  return Array.isArray(docs) ? docs : [];
};

const getManifestCounts = () => {
  if (!fs.existsSync(MANIFEST_PATH)) return {};
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const data = JSON.parse(raw);
    return data?.counts || {};
  } catch {
    return {};
  }
};

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

    const counts = getManifestCounts();
    const files = listSeedFiles();
    const collections = files.map((file) => {
      const name = path.basename(file, '.json');
      return { name, count: typeof counts[name] === 'number' ? counts[name] : null };
    });

    return NextResponse.json({ collections });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load samples' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const files = listSeedFiles();
    if (!files.length) {
      return NextResponse.json({ error: 'No seed files found.' }, { status: 400 });
    }

    const requested = Array.isArray(body?.collections) && body.collections.length
      ? new Set(body.collections.map((c: string) => String(c)))
      : null;

    const targetFiles = requested
      ? files.filter((f) => requested.has(path.basename(f, '.json')))
      : files;

    const uri = process.env.MONGO_URL || process.env.MONGO_PUBLIC_URL || process.env.MONGODB_URI;
    if (!uri) {
      return NextResponse.json({ error: 'Missing MONGO_URL (or MONGO_PUBLIC_URL/MONGODB_URI).' }, { status: 500 });
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(DEFAULT_DB);

    const results: Record<string, any> = {};

    for (const file of targetFiles) {
      const name = path.basename(file, '.json');
      const docs = readCollectionFile(path.join(SEED_DIR, file));
      if (!docs.length) {
        results[name] = { inserted: 0, upserted: 0, modified: 0 };
        continue;
      }

      const collection = db.collection(name);
      const ops = docs.map((doc: any) => {
        if (doc && doc._id) {
          return {
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: doc },
              upsert: true
            }
          };
        }
        return { insertOne: { document: doc } };
      });

      const res = await collection.bulkWrite(ops, { ordered: false });
      results[name] = {
        inserted: res.insertedCount || 0,
        upserted: res.upsertedCount || 0,
        modified: res.modifiedCount || 0
      };
    }

    await client.close();
    return NextResponse.json({ success: true, results, collections: targetFiles.map((f) => path.basename(f, '.json')) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to import samples' }, { status: 500 });
  }
}
