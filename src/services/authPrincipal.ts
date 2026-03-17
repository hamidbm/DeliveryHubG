import type { AccountType } from '../types';
import { resolveCurrentPrincipal, resolvePrincipalFromToken } from '../shared/auth/principal';
import { isGuestAccountType, normalizeAccountType } from '../shared/auth/roles';

export type AuthPrincipal = {
  type: 'user';
  isAuthenticated: true;
  userId: string;
  id: string;
  email?: string;
  role?: string;
  team?: string | null;
  name?: string;
  username?: string;
  accountType: AccountType;
  roles: string[];
  rawPayload: Record<string, unknown>;
};

export const decodeAuthToken = async (token?: string | null): Promise<AuthPrincipal | null> => {
  const principal = await resolvePrincipalFromToken(token);
  if (!principal) return null;
  return {
    type: 'user',
    isAuthenticated: true,
    userId: principal.userId,
    id: principal.userId,
    email: principal.email,
    role: principal.role || undefined,
    team: principal.team,
    name: principal.fullName,
    username: principal.username,
    accountType: principal.accountType,
    roles: principal.role ? [principal.role] : [],
    rawPayload: principal.rawPayload,
  };
};

export const resolveRequestPrincipal = async (): Promise<AuthPrincipal | null> => {
  const principal = await resolveCurrentPrincipal();
  if (!principal) return null;
  return {
    type: 'user',
    isAuthenticated: true,
    userId: principal.userId,
    id: principal.userId,
    email: principal.email,
    role: principal.role || undefined,
    team: principal.team,
    name: principal.fullName,
    username: principal.username,
    accountType: principal.accountType,
    roles: principal.role ? [principal.role] : [],
    rawPayload: principal.rawPayload,
  };
};

export { normalizeAccountType, isGuestAccountType };
