import { cookies } from 'next/headers';

export const AUTH_COOKIE_NAME = 'nexus_auth_token';

const parseCookieHeader = (header: string | null) => {
  const entries = new Map<string, string>();
  String(header || '')
    .split(';')
    .forEach((part) => {
      const [rawKey, ...rawValue] = part.split('=');
      const key = String(rawKey || '').trim();
      if (!key) return;
      entries.set(key, decodeURIComponent(rawValue.join('=').trim()));
    });
  return entries;
};

export const getTokenFromRequest = (request: Request) =>
  parseCookieHeader(request.headers.get('cookie')).get(AUTH_COOKIE_NAME) || null;

export const getTokenFromCookies = async () => {
  const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
  if (testToken) return String(testToken);
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value || null;
};
