import { MongoClient } from 'mongodb';

let cachedPromise: Promise<MongoClient> | null = null;

export const getMongoClientPromise = () => {
  if (cachedPromise) return cachedPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
  }

  const options = {};

  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    // Using globalThis to avoid 'Cannot find name global' error in different environments.
    let globalWithMongo = globalThis as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
      const client = new MongoClient(uri, options);
      globalWithMongo._mongoClientPromise = client.connect();
    }
    cachedPromise = globalWithMongo._mongoClientPromise!;
  } else {
    // In production mode, it's best to not use a global variable.
    const client = new MongoClient(uri, options);
    cachedPromise = client.connect();
  }

  return cachedPromise;
};

export default getMongoClientPromise;
