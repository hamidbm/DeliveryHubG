import { MongoClient, ObjectId } from 'mongodb';
import { createHash } from 'node:crypto';
import { SignJWT } from 'jose';

type TestContext = {
  dbName: string;
  uri: string;
  client: MongoClient;
  db: any;
  setAuthToken: (token: string | null) => void;
  createUser: (args: { name: string; email: string; role: string }) => Promise<{ user: any; token: string }>;
  createBundle: (name: string) => Promise<any>;
  createMilestone: (data: any) => Promise<any>;
  createWorkItem: (data: any) => Promise<any>;
};

const resolveDbName = (value: string) => {
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname || '';
    const name = pathname.replace(/^\//, '');
    return name || 'deliveryhub';
  } catch {
    return 'deliveryhub';
  }
};

const withDbName = (value: string, name: string) => {
  const parsed = new URL(value);
  parsed.pathname = `/${name}`;
  return parsed.toString();
};

let currentToken: string | null = null;
let cookiesMocked = false;

const ensureCookiesMock = async () => {
  if (cookiesMocked) return;
  const headersModule: any = await import('next/headers');
  try {
    headersModule.cookies = async () => ({
      get: (name: string) => {
        if (name === 'nexus_auth_token' && currentToken) return { value: currentToken };
        return undefined;
      }
    });
    cookiesMocked = true;
  } catch (err) {
    throw new Error(`Failed to mock next/headers cookies: ${String(err)}`);
  }
};

const ensureWorkUnitMock = async () => {
  // no-op: keep harness free of Next internal imports to avoid build-time failures
};

const signToken = async (payload: any) => {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(secret);
};

export const runTest = async (name: string, fn: (ctx: TestContext) => Promise<void>) => {
  const baseUri = process.env.MONGO_URL;
  if (!baseUri) {
    throw new Error('Missing MONGO_URL in environment.');
  }
  const baseDb = resolveDbName(baseUri);
  const hash = createHash('sha1')
    .update(`${baseDb}:${name}:${Date.now()}:${Math.random()}`)
    .digest('hex')
    .slice(0, 10);
  const safeName = name.replace(/[^a-z0-9_]/gi, '_').slice(0, 18);
  const testDb = `${baseDb.slice(0, 20)}_t_${safeName}_${hash}`;
  const testUri = withDbName(baseUri, testDb);
  process.env.MONGO_URL = testUri;

  await ensureWorkUnitMock();
  await ensureCookiesMock();

  const client = new MongoClient(testUri);
  await client.connect();
  const db = client.db(testDb);

  const ctx: TestContext = {
    dbName: testDb,
    uri: testUri,
    client,
    db,
    setAuthToken: (token: string | null) => {
      currentToken = token;
    },
    createUser: async ({ name, email, role }) => {
      const user = {
        _id: new ObjectId(),
        name,
        email,
        username: name.toLowerCase().replace(/\s+/g, '.'),
        role,
        team: 'Engineering',
        createdAt: new Date().toISOString()
      };
      await db.collection('users').insertOne(user);
      const token = await signToken({
        id: String(user._id),
        userId: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        team: user.team
      });
      return { user, token };
    },
    createBundle: async (name: string) => {
      const bundle = { _id: new ObjectId(), name };
      await db.collection('bundles').insertOne(bundle);
      return bundle;
    },
    createMilestone: async (data: any) => {
      const milestone = { _id: new ObjectId(), ...data };
      await db.collection('milestones').insertOne(milestone);
      return milestone;
    },
    createWorkItem: async (data: any) => {
      const item = { _id: new ObjectId(), status: 'TODO', ...data };
      await db.collection('workitems').insertOne(item);
      return item;
    }
  };

  try {
    await fn(ctx);
  } catch (err) {
    console.error(`[test:${name}] failure`, err);
    throw err;
  } finally {
    try {
      await db.dropDatabase();
    } catch {}
    await client.close();
  }
};

export const createAuthRequest = (url: string, method: string, body?: any) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
};

export const callRoute = async <T>(
  handler: (req: Request, ctx?: any) => Promise<T>,
  url: string,
  options: { method: string; body?: any; params?: Record<string, string> }
) => {
  const req = createAuthRequest(url, options.method, options.body);
  if (options.params) {
    return await handler(req, { params: Promise.resolve(options.params) });
  }
  return await handler(req);
};
