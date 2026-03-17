import {
  checkAndIncrementAiRateLimitRecord,
  getAiAnalysisCache,
  listWikiAssetAiHistory,
  listWikiQaHistory,
  saveAiAnalysisCacheRecord,
  saveAiAuditLogRecord,
  saveWikiAssetAiHistoryRecord,
  saveWikiQaHistoryRecord
} from '../server/db/repositories/aiSupportRepo';

export const checkAndIncrementAiRateLimit = async (identity: string, limit: number) =>
  checkAndIncrementAiRateLimitRecord(identity, limit);

export const fetchAiAnalysisCache = async (key: string) => getAiAnalysisCache(key);

export const saveAiAnalysisCache = async (key: string, report: any) => saveAiAnalysisCacheRecord(key, report);

export const saveAiAuditLog = async (input: {
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
}) => saveAiAuditLogRecord(input);

export const saveWikiQaHistory = async (input: {
  targetId: string;
  targetType?: 'page' | 'asset';
  ttlDays?: number;
  question: string;
  answer: string;
  provider: string;
  model?: string;
  userEmail?: string;
}) => saveWikiQaHistoryRecord(input);

export const fetchWikiQaHistory = async (targetId: string, targetType: 'page' | 'asset' = 'page', limit = 10) =>
  listWikiQaHistory(targetId, targetType, limit);

export const saveWikiAssetAiHistory = async (input: {
  assetId: string;
  task: string;
  result: string;
  provider: string;
  model?: string;
  userEmail?: string;
  ttlDays?: number;
}) => saveWikiAssetAiHistoryRecord(input);

export const fetchWikiAssetAiHistory = async (assetId: string, limit = 10) =>
  listWikiAssetAiHistory(assetId, limit);
