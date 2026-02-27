import { Role } from '../types';
import { isAdmin } from './db';

type AuthUser = {
  userId?: string;
  id?: string;
  role?: string;
  team?: string;
};

const ENGINEERING_ROLES = new Set<Role>([
  Role.ENGG_LEADER,
  Role.APP_LEADER,
  Role.OT_PM,
  Role.APP_SME,
  Role.EA_LEADER,
  Role.ENGINEERING_EA,
  Role.ENGINEERING_DBA,
  Role.ENGINEERING_IT_OPS
]);

const VENDOR_ROLES = new Set<Role>([
  Role.SVP_DELIVERY_LEAD,
  Role.SVP_PROJECT_MANAGER,
  Role.SVP_TECH_LEAD,
  Role.SVP_ARCHITECT,
  Role.SVP_INFRA_LEAD,
  Role.SVP_SME
]);

export const isEngineeringRole = (role?: string) => ENGINEERING_ROLES.has(role as Role);
export const isVendorRole = (role?: string) => VENDOR_ROLES.has(role as Role);

export const canSubmitForReview = (user?: AuthUser) => {
  if (!user) return false;
  return Boolean(user.userId || user.id || user.role);
};

export const canMarkFeedbackSent = (user?: AuthUser) => user?.role === Role.CMO_MEMBER;

export const canResubmit = (user?: AuthUser) => {
  const role = user?.role;
  return Boolean(role && (isEngineeringRole(role) || isVendorRole(role)));
};

export const canCloseCycle = async (user?: AuthUser) => {
  if (!user) return false;
  if (canResubmit(user)) return true;
  if (user.team === 'Management') return true;
  const userId = String(user.userId || user.id || '');
  if (!userId) return false;
  return await isAdmin(userId);
};

export const canViewArchitectureDiagram = (user?: AuthUser, _diagram?: any) => {
  if (!user) return false;
  return Boolean(user.userId || user.id);
};

export const canEditBundleProfile = async (user?: AuthUser) => {
  if (!user) return false;
  if (user.team === 'Management') return true;
  const userId = String(user.userId || user.id || '');
  if (!userId) return false;
  return await isAdmin(userId);
};
