import type { DeliveryPlanInput, PlanScope } from '../types';
import { findApplicationByAnyId } from '../server/db/repositories/applicationsRepo';
import { listBundleCapacity } from '../server/db/repositories/bundleCapacityRepo';
import { findBundleByAnyId } from '../server/db/repositories/bundlesRepo';

export const resolvePlanScope = async (input: DeliveryPlanInput): Promise<PlanScope> => {
  const scopeType = input.scopeType;
  const scopeId = String(input.scopeId || '');
  if (scopeType === 'PROGRAM') {
    return {
      scopeType,
      scopeId: scopeId || 'program',
      scopeName: 'Program',
      scopeRef: { type: 'initiative', id: 'program', name: 'Program' }
    };
  }

  if (scopeType === 'BUNDLE') {
    const bundle = await findBundleByAnyId(scopeId);
    const resolvedId = bundle?._id ? String(bundle._id) : scopeId;
    const name = bundle?.name || bundle?.key || scopeId;
    return {
      scopeType,
      scopeId,
      scopeName: name,
      bundleId: resolvedId,
      scopeRef: { type: 'bundle', id: resolvedId, name }
    };
  }

  const app = await findApplicationByAnyId(scopeId);
  const resolvedId = app?._id ? String(app._id) : scopeId;
  const name = app?.name || app?.key || scopeId;
  return {
    scopeType,
    scopeId,
    scopeName: name,
    bundleId: app?.bundleId ? String(app.bundleId) : undefined,
    applicationId: resolvedId,
    scopeRef: { type: 'application', id: resolvedId, name }
  };
};

export const getBundleCapacityForPlanning = async (bundleId?: string | null) => {
  if (!bundleId) return null;
  const records = await listBundleCapacity([String(bundleId)]);
  const record = records[0];
  if (!record) return null;
  return {
    unit: record.unit as 'POINTS_PER_SPRINT' | 'POINTS_PER_WEEK',
    value: Number(record.value || 0)
  };
};
