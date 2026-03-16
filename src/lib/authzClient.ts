import { Role } from '../types';

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

export const isEngineeringRoleClient = (role?: string) => ENGINEERING_ROLES.has(role as Role);
export const isVendorRoleClient = (role?: string) => VENDOR_ROLES.has(role as Role);

export const canSubmitForReviewClient = (role?: string, accountType?: string) =>
  String(accountType || '').toUpperCase() !== 'GUEST' && Boolean(role);

export const isGuestAccountClient = (user?: { accountType?: string } | null) =>
  String(user?.accountType || '').toUpperCase() === 'GUEST';

export const canMarkFeedbackSentClient = (role?: string) => role === Role.CMO_MEMBER;

export const canResubmitClient = (role?: string, accountType?: string) =>
  String(accountType || '').toUpperCase() !== 'GUEST' && Boolean(role && (isEngineeringRoleClient(role) || isVendorRoleClient(role)));

export const canEditBundleProfileClient = (user?: { team?: string }, isAdmin?: boolean) =>
  Boolean(!isGuestAccountClient(user as any) && (isAdmin || user?.team === 'Management'));
