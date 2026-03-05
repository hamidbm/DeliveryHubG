import { ObjectId } from 'mongodb';
import { getDb, emitEvent, fetchBundleAssignments } from './db';
import { createVisibilityContext } from './visibility';
import { isAdminOrCmo } from './authz';

export type DecisionLogEntry = {
  _id?: string;
  createdAt: string;
  createdBy: { userId: string; email: string; name?: string };
  scopeType: 'PROGRAM' | 'BUNDLE' | 'MILESTONE' | 'WORK_ITEM';
  scopeId?: string;
  decisionType:
    | 'COMMIT_OVERRIDE'
    | 'READINESS_OVERRIDE'
    | 'CAPACITY_OVERRIDE'
    | 'SCOPE_APPROVAL'
    | 'RISK_ACCEPTED'
    | 'DATE_SLIP_ACCEPTED'
    | 'OTHER';
  title: string;
  rationale: string;
  alternatives?: string;
  outcome: 'APPROVED' | 'REJECTED' | 'ACKNOWLEDGED';
  severity: 'info' | 'warn' | 'critical';
  related?: {
    milestoneId?: string;
    bundleId?: string;
    workItemIds?: string[];
    scopeRequestId?: string;
    commitReviewId?: string;
    driftSnapshotId?: string;
    policyRef?: { globalVersion: number; bundleVersions?: any[] };
  };
  tags?: string[];
};

const ensureDecisionIndexes = async (db: any) => {
  await db.collection('decision_log').createIndex({ scopeType: 1, scopeId: 1, createdAt: -1 });
  await db.collection('decision_log').createIndex({ 'related.milestoneId': 1, createdAt: -1 });
  await db.collection('decision_log').createIndex({ decisionType: 1, createdAt: -1 });
};

export const createDecision = async (entry: DecisionLogEntry) => {
  const db = await getDb();
  await ensureDecisionIndexes(db);
  const payload = { ...entry, createdAt: entry.createdAt || new Date().toISOString() };
  const { _id, ...doc } = payload as any;
  const result = await db.collection('decision_log').insertOne(doc);
  try {
    await emitEvent({
      ts: payload.createdAt,
      type: 'decisions.created',
      actor: {
        userId: entry.createdBy?.userId || 'system',
        displayName: entry.createdBy?.email || entry.createdBy?.name || 'System'
      },
      resource: { type: 'decisions.entry', id: String(result.insertedId), title: entry.title },
      context: {
        milestoneId: entry.related?.milestoneId,
        bundleId: entry.related?.bundleId
      },
      payload
    });
  } catch {}
  return { ...payload, _id: result.insertedId };
};

export const getDecision = async (id: string) => {
  const db = await getDb();
  const doc = await db.collection('decision_log').findOne({ _id: new ObjectId(id) });
  return (doc as unknown as DecisionLogEntry | null);
};

export const listDecisions = async (params: { scopeType?: string; scopeId?: string; milestoneId?: string; limit?: number; cursor?: string }) => {
  const db = await getDb();
  await ensureDecisionIndexes(db);
  const query: any = {};
  if (params.scopeType) query.scopeType = params.scopeType;
  if (params.scopeId) query.scopeId = params.scopeId;
  if (params.milestoneId) query['related.milestoneId'] = params.milestoneId;
  if (params.cursor) {
    query.createdAt = { $lt: params.cursor };
  }
  const limit = Math.min(Math.max(params.limit || 50, 1), 200);
  const items = await db.collection('decision_log').find(query).sort({ createdAt: -1 }).limit(limit).toArray();
  return items as unknown as DecisionLogEntry[];
};

export const canCreateDecisionForScope = async (user: { userId?: string; id?: string; role?: string }, scopeType: DecisionLogEntry['scopeType'], bundleId?: string) => {
  if (!user) return false;
  if (await isAdminOrCmo(user)) return true;
  if (scopeType === 'PROGRAM') return false;
  const userId = String(user.userId || user.id || '');
  if (!userId || !bundleId) return false;
  const assignments = await fetchBundleAssignments({ userId, assignmentType: 'bundle_owner', active: true });
  return assignments.some((a) => String(a.bundleId) === String(bundleId));
};

export const canReadDecision = async (user: { userId?: string; id?: string }, entry: DecisionLogEntry) => {
  if (!user?.userId && !user?.id) return false;
  if (entry.scopeType === 'PROGRAM') return true;
  const visibility = createVisibilityContext({ userId: user.userId || user.id });
  const bundleId = entry.related?.bundleId;
  if (bundleId) return await visibility.canViewBundle(String(bundleId));
  return true;
};
