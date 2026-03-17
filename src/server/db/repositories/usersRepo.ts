import { ObjectId } from 'mongodb';
import { getServerDb } from '../client';

export const ensureUserIndexesInRepo = async () => {
  const db = await getServerDb();
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
};

export const getAdminBootstrapEmailsFromEnv = () => {
  return new Set(
    (process.env.ADMIN_BOOTSTRAP_EMAILS || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
};

export const findUserByEmail = async (email: string, projection?: Record<string, unknown>) => {
  const db = await getServerDb();
  return await db.collection('users').findOne(
    { email },
    projection ? { projection } : undefined
  );
};

export const findUserByUsername = async (username: string, projection?: Record<string, unknown>) => {
  const db = await getServerDb();
  return await db.collection('users').findOne(
    { username },
    projection ? { projection } : undefined
  );
};

export const insertUserRecord = async (doc: Record<string, unknown>) => {
  const db = await getServerDb();
  return await db.collection('users').insertOne(doc);
};

export const findUserById = async (userId: string, projection?: Record<string, unknown>) => {
  if (!ObjectId.isValid(userId)) return null;
  const db = await getServerDb();
  return await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    projection ? { projection } : undefined
  );
};

export const updateUserById = async (userId: string, update: Record<string, unknown>) => {
  if (!ObjectId.isValid(userId)) return null;
  const db = await getServerDb();
  return await db.collection('users').findOneAndUpdate(
    { _id: new ObjectId(userId) },
    update,
    { returnDocument: 'after' }
  );
};

export const listUsersByIds = async (ids: string[]) => {
  try {
    const db = await getServerDb();
    const objectIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    return await db.collection('users').find({ _id: { $in: objectIds } }).project({ password: 0 }).toArray();
  } catch {
    return [];
  }
};

export const listUsersByAnyIds = async (ids: string[]) => {
  try {
    const db = await getServerDb();
    const uniqueIds = Array.from(new Set(ids.map((id) => String(id || '')).filter(Boolean)));
    if (!uniqueIds.length) return [];
    const objectIds = uniqueIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    return await db.collection('users').find({
      $or: [
        objectIds.length ? { _id: { $in: objectIds } } : null,
        { id: { $in: uniqueIds } },
        { userId: { $in: uniqueIds } }
      ].filter(Boolean)
    }).project({ password: 0 }).toArray();
  } catch {
    return [];
  }
};

export const searchUsersByQuery = async (query: string) => {
  try {
    const db = await getServerDb();
    await ensureUserIndexesInRepo();
    return await db.collection('users').find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } }
      ]
    }).limit(10).project({ password: 0 }).toArray();
  } catch {
    return [];
  }
};

export const searchUsersWithFilters = async (input: {
  query?: string;
  roleClauses?: Record<string, unknown>[];
  limit?: number;
}) => {
  try {
    const db = await getServerDb();
    await ensureUserIndexesInRepo();
    const mongoQuery: any = {};

    if (input.query) {
      const regex = new RegExp(escapeRegExp(input.query), 'i');
      mongoQuery.$or = [{ name: regex }, { email: regex }, { username: regex }];
    }

    if (input.roleClauses?.length) {
      mongoQuery.$and = mongoQuery.$and || [];
      mongoQuery.$and.push({ $or: input.roleClauses });
    }

    return await db.collection('users')
      .find(mongoQuery)
      .limit(input.limit || 20)
      .project({ password: 0 })
      .toArray();
  } catch {
    return [];
  }
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const resolveUsersForMentions = async (tokens: string[]) => {
  try {
    const db = await getServerDb();
    const uniqueTokens = Array.from(new Set(tokens.map((t) => t.trim()).filter(Boolean)));
    if (uniqueTokens.length === 0) return [];

    const emailTokens = uniqueTokens.filter((t) => t.includes('@') && t.includes('.'));
    const nameTokens = uniqueTokens.filter((t) => !t.includes('@'));

    const orClauses: any[] = [];
    if (emailTokens.length) {
      orClauses.push(...emailTokens.map((t) => ({ email: { $regex: `^${escapeRegExp(t)}$`, $options: 'i' } })));
    }
    if (nameTokens.length) {
      orClauses.push(...nameTokens.map((t) => ({ username: { $regex: `^${escapeRegExp(t)}$`, $options: 'i' } })));
      orClauses.push(...nameTokens.map((t) => ({ name: { $regex: `^${escapeRegExp(t)}$`, $options: 'i' } })));
      orClauses.push(...nameTokens.map((t) => ({ email: { $regex: `^${escapeRegExp(t)}@`, $options: 'i' } })));
    }
    if (!orClauses.length) return [];

    const users = await db.collection('users')
      .find({ $or: orClauses })
      .limit(20)
      .project({ password: 0 })
      .toArray();

    return users.map((user: any) => ({
      userId: String(user._id || user.id || ''),
      displayName: String(user.name || user.displayName || 'Unknown'),
      email: user.email ? String(user.email) : undefined
    }));
  } catch {
    return [];
  }
};

export const findWorkflowRuleAssigneeCandidate = async () => {
  const db = await getServerDb();
  return await db.collection('users').findOne(
    {
      $or: [
        { role: { $in: ['SVP SME', 'SVP Architect', 'SVP Engineer'] } },
        { team: 'SVP' }
      ]
    },
    { projection: { _id: 1, email: 1, name: 1 } }
  );
};

export const listWorkflowRuleStakeholderEmails = async (limit = 30) => {
  const db = await getServerDb();
  const recipients = await db.collection('users')
    .find({ role: { $in: ['Director', 'VP', 'CIO', 'CMO Architect'] } })
    .project({ email: 1 })
    .limit(limit)
    .toArray();
  return recipients.map((item: any) => String(item.email || '').trim()).filter(Boolean);
};
