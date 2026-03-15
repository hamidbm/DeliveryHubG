import { MongoClient } from 'mongodb';

let cachedPromise: Promise<MongoClient> | null = null;
let cachedUri: string | null = null;

const DEFAULT_DB_NAME = 'delivery';

const resolveDbNameFromUri = (uri: string) => {
  try {
    const parsed = new URL(uri);
    const path = (parsed.pathname || '').replace(/^\/+/, '').trim();
    if (!path) return DEFAULT_DB_NAME;
    const dbName = decodeURIComponent(path.split('/')[0] || '').trim();
    return dbName || DEFAULT_DB_NAME;
  } catch {
    // If URI parsing fails for any reason, keep app behavior deterministic.
    return DEFAULT_DB_NAME;
  }
};

export const getMongoDbName = () => {
  const uri = process.env.MONGO_URL;
  if (!uri) {
    throw new Error('Invalid/Missing environment variable: "MONGO_URL"');
  }
  return resolveDbNameFromUri(uri);
};

export const getMongoClientPromise = () => {
  const uri = process.env.MONGO_URL;
  if (!uri) {
    throw new Error('Invalid/Missing environment variable: "MONGO_URL"');
  }

  if (cachedPromise && cachedUri === uri) return cachedPromise;

  const options = {};

  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    // Using globalThis to avoid 'Cannot find name global' error in different environments.
    let globalWithMongo = globalThis as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
      _mongoClientUri?: string;
    };

    if (!globalWithMongo._mongoClientPromise || globalWithMongo._mongoClientUri !== uri) {
      const client = new MongoClient(uri, options);
      globalWithMongo._mongoClientPromise = client.connect();
      globalWithMongo._mongoClientUri = uri;
    }
    cachedPromise = globalWithMongo._mongoClientPromise!;
    cachedUri = globalWithMongo._mongoClientUri || uri;
  } else {
    // In production mode, it's best to not use a global variable.
    const client = new MongoClient(uri, options);
    cachedPromise = client.connect();
    cachedUri = uri;
  }

  return cachedPromise;
};

export default getMongoClientPromise;
