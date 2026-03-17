import { ObjectId } from 'mongodb';
import { getServerDb } from '../client';

const ensureWikiQaIndexes = async (db: any) => {
  await db.collection('wiki_qa_history').createIndex({ targetType: 1, targetId: 1, createdAt: -1 });
  await db.collection('wiki_qa_history').createIndex({ targetType: 1, targetIdStr: 1, createdAt: -1 });
  await db.collection('wiki_qa_history').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
};

const ensureWikiAssetAiIndexes = async (db: any) => {
  await db.collection('wiki_asset_ai_history').createIndex({ assetId: 1, createdAt: -1 });
  await db.collection('wiki_asset_ai_history').createIndex({ assetIdStr: 1, createdAt: -1 });
  await db.collection('wiki_asset_ai_history').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
};

const ensureAiAuditIndexes = async (db: any) => {
  await db.collection('ai_audit_logs').createIndex({ createdAt: -1 });
  await db.collection('ai_audit_logs').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
};

const ensureAiRateLimitIndexes = async (db: any) => {
  await db.collection('ai_rate_limits').createIndex({ identity: 1, windowStart: 1 }, { unique: true });
  await db.collection('ai_rate_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
};

const ensureAiAnalysisCacheIndexes = async (db: any) => {
  await db.collection('ai_analysis_cache').createIndex({ updatedAt: -1 });
};

export const saveWikiQaHistoryRecord = async ({
  targetId,
  targetType = 'page',
  ttlDays = 30,
  question,
  answer,
  provider,
  model,
  userEmail
}: {
  targetId: string;
  targetType?: 'page' | 'asset';
  ttlDays?: number;
  question: string;
  answer: string;
  provider: string;
  model?: string;
  userEmail?: string;
}) => {
  const db = await getServerDb();
  await ensureWikiQaIndexes(db);
  const isValidId = ObjectId.isValid(targetId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * Math.max(ttlDays, 1));
  return await db.collection('wiki_qa_history').insertOne({
    targetType,
    targetId: isValidId ? new ObjectId(targetId) : undefined,
    targetIdStr: isValidId ? undefined : targetId,
    question,
    answer,
    provider,
    model,
    userEmail,
    createdAt: now.toISOString(),
    expiresAt
  });
};

export const listWikiQaHistory = async (targetId: string, targetType: 'page' | 'asset' = 'page', limit = 10) => {
  try {
    const db = await getServerDb();
    await ensureWikiQaIndexes(db);
    const isValidId = ObjectId.isValid(targetId);
    return await db
      .collection('wiki_qa_history')
      .find(isValidId ? { targetType, targetId: new ObjectId(targetId) } : { targetType, targetIdStr: targetId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  } catch {
    return [];
  }
};

export const saveWikiAssetAiHistoryRecord = async ({
  assetId,
  task,
  result,
  provider,
  model,
  userEmail,
  ttlDays = 30
}: {
  assetId: string;
  task: string;
  result: string;
  provider: string;
  model?: string;
  userEmail?: string;
  ttlDays?: number;
}) => {
  const db = await getServerDb();
  await ensureWikiAssetAiIndexes(db);
  const isValidId = ObjectId.isValid(assetId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * Math.max(ttlDays, 1));
  return await db.collection('wiki_asset_ai_history').insertOne({
    assetId: isValidId ? new ObjectId(assetId) : undefined,
    assetIdStr: isValidId ? undefined : assetId,
    task,
    result,
    provider,
    model,
    userEmail,
    createdAt: now.toISOString(),
    expiresAt
  });
};

export const listWikiAssetAiHistory = async (assetId: string, limit = 10) => {
  try {
    const db = await getServerDb();
    await ensureWikiAssetAiIndexes(db);
    const isValidId = ObjectId.isValid(assetId);
    return await db
      .collection('wiki_asset_ai_history')
      .find(isValidId ? { assetId: new ObjectId(assetId) } : { assetIdStr: assetId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  } catch {
    return [];
  }
};

export const saveAiAuditLogRecord = async ({
  task,
  provider,
  model,
  targetType,
  targetId,
  success,
  error,
  latencyMs,
  identity,
  ttlDays = 30
}: {
  task: string;
  provider: string;
  model?: string;
  targetType?: string;
  targetId?: string;
  success: boolean;
  error?: string;
  latencyMs?: number;
  identity?: string;
  ttlDays?: number;
}) => {
  const db = await getServerDb();
  await ensureAiAuditIndexes(db);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * Math.max(ttlDays, 1));
  return await db.collection('ai_audit_logs').insertOne({
    task,
    provider,
    model,
    targetType,
    targetId,
    success,
    error,
    latencyMs,
    identity,
    createdAt: now.toISOString(),
    expiresAt
  });
};

export const checkAndIncrementAiRateLimitRecord = async (identity: string, limit: number) => {
  const db = await getServerDb();
  await ensureAiRateLimitIndexes(db);
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setMinutes(0, 0, 0);
  const expiresAt = new Date(windowStart.getTime() + 1000 * 60 * 60 * 2);
  const key = { identity, windowStart: windowStart.toISOString() };

  const result = await db.collection('ai_rate_limits').findOneAndUpdate(
    key,
    {
      $inc: { count: 1 },
      $setOnInsert: { createdAt: now.toISOString(), expiresAt }
    },
    { upsert: true, returnDocument: 'after' }
  );

  const count = result?.value?.count || 1;
  return count <= limit;
};

export const getAiAnalysisCache = async (key: string) => {
  try {
    const db = await getServerDb();
    await ensureAiAnalysisCacheIndexes(db);
    return await db.collection('ai_analysis_cache').findOne({ _id: key } as any);
  } catch {
    return null;
  }
};

export const listAiAnalysisCacheRecordsByReportType = async (reportType: string, limit = 30) => {
  try {
    const db = await getServerDb();
    await ensureAiAnalysisCacheIndexes(db);
    return await db.collection('ai_analysis_cache')
      .find({ reportType } as any)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();
  } catch {
    return [];
  }
};

export const saveAiAnalysisCacheRecord = async (key: string, report: any) => {
  const db = await getServerDb();
  await ensureAiAnalysisCacheIndexes(db);
  const now = new Date().toISOString();
  const isFirstClassReport = Boolean(report && typeof report === 'object' && report.status && report.metadata && report.report);
  const payload = isFirstClassReport
    ? { ...report, reportType: report.reportType || key, updatedAt: now }
    : { report, updatedAt: now };
  return await db.collection('ai_analysis_cache').updateOne(
    { _id: key } as any,
    { $set: payload },
    { upsert: true }
  );
};
