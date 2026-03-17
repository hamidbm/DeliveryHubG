import { jwtVerify } from 'jose';
import { getTokenFromCookies, getTokenFromRequest } from './session';
import { normalizeAccountType, type Principal } from './roles';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const principalFromPayload = (payload: Record<string, unknown>): Principal | null => {
  const userId = String(payload.id || payload.userId || '');
  if (!userId) return null;
  return {
    userId,
    email: payload.email ? String(payload.email) : undefined,
    fullName: payload.name ? String(payload.name) : undefined,
    team: payload.team ? String(payload.team) : null,
    role: payload.role ? String(payload.role) : null,
    username: payload.username ? String(payload.username) : undefined,
    accountType: normalizeAccountType(payload.accountType ? String(payload.accountType) : null),
    isAuthenticated: true,
    rawPayload: payload,
  };
};

export const resolvePrincipalFromToken = async (token?: string | null): Promise<Principal | null> => {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return principalFromPayload(payload as Record<string, unknown>);
  } catch {
    return null;
  }
};

export async function resolvePrincipal(request: Request): Promise<Principal | null> {
  const requestToken = getTokenFromRequest(request);
  if (requestToken) {
    return await resolvePrincipalFromToken(requestToken);
  }
  if (process.env.NODE_ENV === 'test') {
    return await resolvePrincipalFromToken(await getTokenFromCookies());
  }
  return null;
}

export async function resolveCurrentPrincipal(): Promise<Principal | null> {
  return await resolvePrincipalFromToken(await getTokenFromCookies());
}
