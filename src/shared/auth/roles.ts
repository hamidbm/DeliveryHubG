import type { AccountType } from '../../types';

export type Principal = {
  userId: string;
  email?: string;
  fullName?: string;
  team?: string | null;
  role?: string | null;
  username?: string;
  accountType: AccountType;
  isAuthenticated: true;
  rawPayload: Record<string, unknown>;
};

export const normalizeAccountType = (value?: string | null): AccountType =>
  String(value || '').trim().toUpperCase() === 'GUEST' ? 'GUEST' : 'STANDARD';

export const isGuestAccountType = (value?: string | null) => normalizeAccountType(value) === 'GUEST';
export const isGuestPrincipal = (principal?: Pick<Principal, 'accountType'> | null) =>
  principal?.accountType === 'GUEST';
export const isStandardPrincipal = (principal?: Pick<Principal, 'accountType'> | null) =>
  principal?.accountType === 'STANDARD';
