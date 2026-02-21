import { Role } from '../types';
import { isAdmin } from './db';

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

export const canSubmitForReview = (user?: { role?: string }) => {
  if (!user?.role) return false;
  return isEngineeringRole(user.role) || isVendorRole(user.role) || user.role === Role.CMO_MEMBER;
};

export const canMarkFeedbackSent = (user?: { role?: string }) => {
  return user?.role === Role.CMO_MEMBER;
};

export const canResubmit = (user?: { role?: string }) => {
  if (!user?.role) return false;
  return isEngineeringRole(user.role) || isVendorRole(user.role);
};

export const canCloseCycle = async (user?: { role?: string; userId?: string; id?: string }) => {
  if (!user) return false;
  if (isEngineeringRole(user.role) || isVendorRole(user.role)) return true;
  const uid = String(user.userId || user.id || '');
  if (uid) return await isAdmin(uid);
  return false;
};
