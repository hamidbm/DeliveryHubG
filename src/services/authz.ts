import { Role } from '../types';
import { hasAdminRecord } from '../server/db/repositories/adminsRepo';
import { listBundleAssignments } from '../server/db/repositories/bundleAssignmentsRepo';

type AuthUser = {
  userId?: string;
  id?: string;
  role?: string;
  team?: string;
  email?: string;
  accountType?: 'STANDARD' | 'GUEST';
};

export const isGuestAccount = (user?: AuthUser | null) => String(user?.accountType || '').toUpperCase() === 'GUEST';

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

const isAdminOrCmoRole = (role?: string) => {
  const roleName = String(role || '');
  if (!roleName) return false;
  const lower = roleName.toLowerCase();
  if (lower.includes('admin')) return true;
  if (lower.includes('cmo')) return true;
  const privilegedRoles = new Set([
    'CMO Architect',
    'CMO Member'
  ]);
  return privilegedRoles.has(roleName);
};

export const getBundleOwnership = async (userId?: string) => {
  const uid = String(userId || '');
  if (!uid) return [];
  const assignments = await listBundleAssignments({ userId: uid, assignmentType: 'bundle_owner', active: true });
  return assignments.map((a) => String(a.bundleId)).filter(Boolean);
};

const isBundleOwner = async (user?: AuthUser, bundleId?: string) => {
  const userId = String(user?.userId || user?.id || '');
  if (!userId || !bundleId) return false;
  const ownership = await getBundleOwnership(userId);
  return ownership.includes(String(bundleId));
};

export const isAdminOrCmo = async (user?: AuthUser) => {
  if (!user) return false;
  if (isGuestAccount(user)) return false;
  if (isAdminOrCmoRole(user.role)) return true;
  const userId = String(user.userId || user.id || '');
  if (!userId) return false;
  return await hasAdminRecord(userId);
};

export const canSubmitForReview = (user?: AuthUser) => {
  if (!user) return false;
  if (isGuestAccount(user)) return false;
  return Boolean(user.userId || user.id || user.role);
};

export const canMarkFeedbackSent = (user?: AuthUser) => user?.role === Role.CMO_MEMBER;

export const canResubmit = (user?: AuthUser) => {
  if (isGuestAccount(user)) return false;
  const role = user?.role;
  return Boolean(role && (isEngineeringRole(role) || isVendorRole(role)));
};

export const canCloseCycle = async (user?: AuthUser) => {
  if (!user) return false;
  if (canResubmit(user)) return true;
  if (user.team === 'Management') return true;
  const userId = String(user.userId || user.id || '');
  if (!userId) return false;
  return await hasAdminRecord(userId);
};

export const canViewArchitectureDiagram = (user?: AuthUser, _diagram?: any) => {
  if (!user) return false;
  return Boolean(user.userId || user.id);
};

export const canComment = (user?: AuthUser) => {
  if (!user) return false;
  return Boolean(user.userId || user.id);
};

export const canEditBundleProfile = async (user?: AuthUser) => {
  if (!user) return false;
  if (isGuestAccount(user)) return false;
  if (user.team === 'Management') return true;
  const userId = String(user.userId || user.id || '');
  if (!userId) return false;
  return await hasAdminRecord(userId);
};

export const isPrivilegedMilestoneRole = (role?: string) => {
  const roleName = String(role || '');
  if (!roleName) return false;
  if (roleName.toLowerCase().includes('admin')) return true;
  if (roleName.toLowerCase().includes('cmo')) return true;
  const privilegedRoles = new Set([
    'CMO Architect',
    'CMO Member',
    'SVP Architect',
    'Director',
    'VP',
    'CIO'
  ]);
  return privilegedRoles.has(roleName);
};

export const canCommitMilestone = async (user?: AuthUser) => {
  if (isGuestAccount(user)) return false;
  return await isAdminOrCmo(user);
};

export const canStartMilestone = async (user?: AuthUser) => {
  if (isGuestAccount(user)) return false;
  return await isAdminOrCmo(user);
};

export const canCompleteMilestone = async (user?: AuthUser) => {
  if (isGuestAccount(user)) return false;
  return await isAdminOrCmo(user);
};

export const canOverrideMilestoneReadiness = async (user?: AuthUser) => {
  if (isGuestAccount(user)) return false;
  return await isAdminOrCmo(user);
};

export const canOverrideCapacity = async (user?: AuthUser) => {
  if (isGuestAccount(user)) return false;
  return await isAdminOrCmo(user);
};

export const canManageSprints = async (user?: AuthUser) => {
  if (isGuestAccount(user)) return false;
  return await isAdminOrCmo(user);
};

export const canEditCommittedMilestoneScope = async (user?: AuthUser, milestone?: any) => {
  if (!user || !milestone?.bundleId) return false;
  if (isGuestAccount(user)) return false;
  if (await isAdminOrCmo(user)) return true;
  return await isBundleOwner(user, String(milestone.bundleId));
};

export const canEditMilestoneOwner = async (user?: AuthUser, bundleIds: string[] = []) => {
  if (!user) return false;
  if (isGuestAccount(user)) return false;
  if (await isAdminOrCmo(user)) return true;
  const userId = String(user.userId || user.id || '');
  if (!userId) return false;
  const ownership = await getBundleOwnership(userId);
  return bundleIds.some((id) => ownership.includes(String(id)));
};

export const canCreateBlocksDependency = async (user?: AuthUser, sourceItem?: any, targetItem?: any) => {
  if (!user) return false;
  if (isGuestAccount(user)) return false;
  if (await isAdminOrCmo(user)) return true;
  if (!sourceItem || !targetItem) return false;
  const sourceBundle = sourceItem.bundleId ? String(sourceItem.bundleId) : '';
  const targetBundle = targetItem.bundleId ? String(targetItem.bundleId) : '';
  if (!sourceBundle || !targetBundle || sourceBundle !== targetBundle) return false;
  return await isBundleOwner(user, sourceBundle);
};

export const canRemoveBlocksDependency = async (user?: AuthUser, sourceItem?: any, targetItem?: any) => {
  return await canCreateBlocksDependency(user, sourceItem, targetItem);
};

export const canEditRiskSeverity = async (user?: AuthUser, item?: any) => {
  if (!user || !item?.bundleId) return false;
  if (isGuestAccount(user)) return false;
  if (await isAdminOrCmo(user)) return true;
  return await isBundleOwner(user, String(item.bundleId));
};
