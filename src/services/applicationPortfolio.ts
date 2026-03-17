import type {
  ApplicationDependency,
  ApplicationEnvironmentStrategy,
  ApplicationLifecycleRecord,
  ApplicationPortfolio,
  ReleaseTrain
} from '../types';
import {
  computeApplicationDeliveryImpactRecord,
  createApplicationDependencyRecord,
  createApplicationPortfolioRecord,
  createReleaseTrainRecord,
  deleteApplicationDependencyRecord,
  ensureApplicationPortfolioIndexes,
  getApplicationEnvironmentStrategyRecord,
  getApplicationLifecycleRecordByApp,
  getApplicationPortfolioByIdRecord,
  getReleaseTrainByIdRecord,
  listApplicationDependenciesRecord,
  listApplicationPortfoliosRecord,
  listReleaseTrainsRecord,
  upsertApplicationEnvironmentStrategyRecord,
  upsertApplicationLifecycleRecord,
  updateApplicationPortfolioRecord,
  updateReleaseTrainRecord
} from '../server/db/repositories/applicationPortfolioRepo';

export { ensureApplicationPortfolioIndexes };

export const listApplicationPortfolios = async () => {
  return await listApplicationPortfoliosRecord();
};

export const createApplicationPortfolio = async (payload: Partial<ApplicationPortfolio>) => {
  return await createApplicationPortfolioRecord(payload);
};

export const getApplicationPortfolioById = async (id: string) => {
  return await getApplicationPortfolioByIdRecord(id);
};

export const updateApplicationPortfolio = async (id: string, payload: Partial<ApplicationPortfolio>) => {
  return await updateApplicationPortfolioRecord(id, payload);
};

export const listReleaseTrains = async (portfolioId?: string) => {
  return await listReleaseTrainsRecord(portfolioId);
};

export const createReleaseTrain = async (payload: Partial<ReleaseTrain>) => {
  return await createReleaseTrainRecord(payload);
};

export const getReleaseTrainById = async (id: string) => {
  return await getReleaseTrainByIdRecord(id);
};

export const updateReleaseTrain = async (id: string, payload: Partial<ReleaseTrain>) => {
  return await updateReleaseTrainRecord(id, payload);
};

export const listApplicationDependencies = async (applicationId?: string) => {
  return await listApplicationDependenciesRecord(applicationId);
};

export const createApplicationDependency = async (payload: Partial<ApplicationDependency>) => {
  return await createApplicationDependencyRecord(payload);
};

export const deleteApplicationDependency = async (id: string) => {
  return await deleteApplicationDependencyRecord(id);
};

export const getApplicationLifecycle = async (applicationId: string) => {
  return await getApplicationLifecycleRecordByApp(applicationId);
};

export const upsertApplicationLifecycle = async (applicationId: string, payload: Partial<ApplicationLifecycleRecord>) => {
  return await upsertApplicationLifecycleRecord(applicationId, payload);
};

export const getApplicationEnvironmentStrategy = async (applicationId: string) => {
  return await getApplicationEnvironmentStrategyRecord(applicationId);
};

export const upsertApplicationEnvironmentStrategy = async (
  applicationId: string,
  payload: Partial<ApplicationEnvironmentStrategy>
) => {
  return await upsertApplicationEnvironmentStrategyRecord(applicationId, payload);
};

export const computeApplicationDeliveryImpact = async (applicationId: string) => {
  return await computeApplicationDeliveryImpactRecord(applicationId);
};
