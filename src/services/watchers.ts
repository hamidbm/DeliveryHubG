import {
  addWatcherRecord,
  listWatcherUserIdsForScopesRecord,
  listWatchersByUserRecord,
  listWatchersForScopeRecord,
  removeWatcherRecord,
  type WatchScope
} from '../server/db/repositories/watchersRepo';
import { hasActiveBundleOwnerAssignment } from '../server/db/repositories/bundleAssignmentsRepo';

export type { WatchScope } from '../server/db/repositories/watchersRepo';

export const addWatcher = async (userId: string, scopeType: WatchScope, scopeId: string, createdBy?: string) => {
  return await addWatcherRecord(userId, scopeType, scopeId, createdBy);
};

export const removeWatcher = async (userId: string, scopeType: WatchScope, scopeId: string) => {
  return await removeWatcherRecord(userId, scopeType, scopeId);
};

export const listWatchersByUser = async (userId: string, scopeType?: WatchScope) => {
  return await listWatchersByUserRecord(userId, scopeType);
};

export const listWatchersForScope = async (scopeType: WatchScope, scopeId: string) => {
  return await listWatchersForScopeRecord(scopeType, scopeId);
};

export const listWatcherUserIdsForScopes = async (scopes: Array<{ scopeType: WatchScope; scopeId: string }>) => {
  return await listWatcherUserIdsForScopesRecord(scopes);
};

export const canViewScopeWatchers = async (scopeType: WatchScope, scopeId: string, user: { userId?: string; role?: string } | null) => {
  if (!user?.userId) return false;
  const roleName = String(user.role || '').toLowerCase();
  if (roleName.includes('admin') || roleName.includes('cmo')) return true;
  if (scopeType !== 'BUNDLE') return false;
  return await hasActiveBundleOwnerAssignment(String(scopeId), String(user.userId));
};
