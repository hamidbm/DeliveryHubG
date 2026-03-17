import { findBundleByAnyId } from '../server/db/repositories/bundlesRepo';
import { getMilestoneByRef } from '../server/db/repositories/milestonesRepo';
import { listDashboardMilestoneItemRecords, loadDashboardContextRepo, type DashboardContextRecord } from '../server/db/repositories/dashboardRepo';

export const loadDashboardContextRecord = async (): Promise<DashboardContextRecord> => {
  return await loadDashboardContextRepo();
};

export const getDashboardBundleRecord = async (bundleId: string) => {
  return await findBundleByAnyId(bundleId);
};

export const getDashboardMilestoneRecord = async (milestoneId: string) => {
  return await getMilestoneByRef(milestoneId);
};

export const listDashboardMilestoneItems = async (milestoneId: string) => {
  return await listDashboardMilestoneItemRecords(milestoneId);
};
