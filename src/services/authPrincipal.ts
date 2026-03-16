import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import type { AccountType } from '../types';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export type AuthPrincipal = {
  type: 'user';
  isAuthenticated: true;
  userId: string;
  id: string;
  email?: string;
  role?: string;
  team?: string;
  name?: string;
  username?: string;
  accountType: AccountType;
  roles: string[];
  rawPayload: Record<string, any>;
};

export const normalizeAccountType = (value?: string | null): AccountType =>
  String(value || '').trim().toUpperCase() === 'GUEST' ? 'GUEST' : 'STANDARD';

export const isGuestAccountType = (value?: string | null) => normalizeAccountType(value) === 'GUEST';

export const decodeAuthToken = async (token?: string | null): Promise<AuthPrincipal | null> => {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = String((payload as any).id || (payload as any).userId || '');
    if (!userId) return null;
    const role = (payload as any).role ? String((payload as any).role) : undefined;
    const accountType = normalizeAccountType((payload as any).accountType);
    return {
      type: 'user',
      isAuthenticated: true,
      userId,
      id: userId,
      email: (payload as any).email ? String((payload as any).email) : undefined,
      role,
      team: (payload as any).team ? String((payload as any).team) : undefined,
      name: (payload as any).name ? String((payload as any).name) : undefined,
      username: (payload as any).username ? String((payload as any).username) : undefined,
      accountType,
      roles: role ? [role] : [],
      rawPayload: payload as Record<string, any>
    };
  } catch {
    return null;
  }
};

export const resolveRequestPrincipal = async (): Promise<AuthPrincipal | null> => {
  const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
  const cookieStore = testToken ? null : await cookies();
  const token = testToken || cookieStore?.get('nexus_auth_token')?.value;
  return await decodeAuthToken(token);
};
