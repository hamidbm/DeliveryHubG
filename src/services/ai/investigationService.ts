import { ObjectId } from 'mongodb';
import { getDb, fetchAiAnalysisCache } from '../db';
import { SavedInvestigation, PortfolioQueryResponse, PortfolioSummaryResponse } from '../../types/ai';
import { detectPortfolioQueryIntent, answerPortfolioQuestionDeterministically } from './queryEngine';
import { derivePortfolioSignals } from './portfolioSignals';
import { loadTrendSignals } from './trendAnalyzer';
import { resolveRelatedEntitiesMetaFromEvidence } from '../entityMetaResolver';

const COLLECTION = 'ai_saved_queries';
const CACHE_KEY = 'portfolio-summary';

const ensureIndexes = async (db: any) => {
  const col = db.collection(COLLECTION);
  await col.createIndex({ userId: 1, createdAt: -1 });
  await col.createIndex({ userId: 1, pinned: 1, updatedAt: -1 });
};

const toSavedInvestigation = (doc: any): SavedInvestigation => ({
  id: String(doc._id || doc.id || ''),
  userId: String(doc.userId || ''),
  question: String(doc.question || ''),
  normalizedIntent: doc.normalizedIntent ? String(doc.normalizedIntent) : undefined,
  answer: String(doc.answer || ''),
  explanation: String(doc.explanation || ''),
  evidence: Array.isArray(doc.evidence) ? doc.evidence : [],
  entities: Array.isArray(doc.entities) ? doc.entities : [],
  followUps: Array.isArray(doc.followUps) ? doc.followUps : [],
  pinned: Boolean(doc.pinned),
  relatedEntitiesMeta: doc.relatedEntitiesMeta || undefined,
  createdAt: String(doc.createdAt || new Date().toISOString()),
  updatedAt: String(doc.updatedAt || new Date().toISOString())
});

const toDocId = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : id);

export const saveInvestigation = async (
  userId: string,
  question: string,
  queryResult: PortfolioQueryResponse
) => {
  const db = await getDb();
  await ensureIndexes(db);
  const col: any = db.collection(COLLECTION);
  const now = new Date().toISOString();
  const doc = {
    userId: String(userId),
    question: String(question || '').trim(),
    normalizedIntent: detectPortfolioQueryIntent(question || ''),
    answer: queryResult.answer || '',
    explanation: queryResult.explanation || '',
    evidence: Array.isArray(queryResult.evidence) ? queryResult.evidence : [],
    entities: Array.isArray(queryResult.entities) ? queryResult.entities : [],
    followUps: Array.isArray(queryResult.followUps) ? queryResult.followUps : [],
    relatedEntitiesMeta: queryResult.relatedEntitiesMeta || undefined,
    pinned: false,
    createdAt: now,
    updatedAt: now
  };
  const res = await col.insertOne(doc);
  return String(res.insertedId);
};

export const getInvestigations = async (userId: string) => {
  const db = await getDb();
  await ensureIndexes(db);
  const col: any = db.collection(COLLECTION);
  const rows = await col
    .find({ userId: String(userId) })
    .sort({ pinned: -1, updatedAt: -1 })
    .toArray();
  return rows.map(toSavedInvestigation);
};

export const updateInvestigation = async (
  userId: string,
  id: string,
  patch: Partial<Pick<SavedInvestigation, 'pinned'>>
) => {
  const db = await getDb();
  await ensureIndexes(db);
  const col: any = db.collection(COLLECTION);
  const _id = toDocId(id);
  await col.updateOne(
    { _id, userId: String(userId) },
    { $set: { ...patch, updatedAt: new Date().toISOString() } }
  );
  const next = await col.findOne({ _id, userId: String(userId) });
  return next ? toSavedInvestigation(next) : null;
};

export const deleteInvestigation = async (userId: string, id: string) => {
  const db = await getDb();
  await ensureIndexes(db);
  const col: any = db.collection(COLLECTION);
  const _id = toDocId(id);
  const res = await col.deleteOne({ _id, userId: String(userId) });
  return res.deletedCount > 0;
};

const loadPortfolioContext = async (): Promise<PortfolioSummaryResponse | null> => {
  const cached = await fetchAiAnalysisCache(CACHE_KEY);
  if (!cached) return null;
  const source = cached?.status === 'success'
    ? cached
    : (cached?.report?.status === 'success' ? cached.report : null);
  if (!source) return null;
  return {
    status: 'success',
    metadata: source.metadata,
    snapshot: source.snapshot,
    report: source.report,
    relatedEntitiesMeta: source.relatedEntitiesMeta
  };
};

export const refreshInvestigation = async (userId: string, id: string) => {
  const db = await getDb();
  await ensureIndexes(db);
  const col: any = db.collection(COLLECTION);
  const _id = toDocId(id);
  const row = await col.findOne({ _id, userId: String(userId) });
  if (!row) return null;
  const current = toSavedInvestigation(row);

  const cached = await loadPortfolioContext();
  if (!cached?.snapshot) return current;
  const trendContext = await loadTrendSignals();

  const deterministic = answerPortfolioQuestionDeterministically(
    current.question,
    derivePortfolioSignals(cached.snapshot),
    cached.report,
    cached.snapshot,
    cached.report?.trendSignals || trendContext.trendSignals,
    trendContext.history
  );
  const relatedEntitiesMeta = await resolveRelatedEntitiesMetaFromEvidence(deterministic.evidence || []);
  const update = {
    normalizedIntent: detectPortfolioQueryIntent(current.question || ''),
    answer: deterministic.answer,
    explanation: deterministic.explanation,
    evidence: deterministic.evidence,
    entities: deterministic.entities || [],
    followUps: deterministic.followUps,
    relatedEntitiesMeta,
    updatedAt: new Date().toISOString()
  };
  await col.updateOne({ _id, userId: String(userId) }, { $set: update });
  const next = await col.findOne({ _id, userId: String(userId) });
  return next ? toSavedInvestigation(next) : null;
};
