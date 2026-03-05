import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('nexus_auth_token')?.value;

  // 1. Define Public Paths
  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isPublicApi = pathname.startsWith('/api/auth');
  const isStaticFile = pathname.startsWith('/_next') || pathname.includes('favicon.ico');

  // 2. Allow static files and public auth APIs to pass through without checks
  if (isStaticFile || isPublicApi) {
    return NextResponse.next();
  }

  // 3. Handle Authenticated users trying to access Login/Register
  if (isAuthPage && token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      // Valid token found, redirect to dashboard
      return NextResponse.redirect(new URL('/', request.url));
    } catch (error) {
      // Token invalid, allow them to see the login page but clear the cookie
      const response = NextResponse.next();
      response.cookies.delete('nexus_auth_token');
      return response;
    }
  }

  // 4. Handle Protected Paths (Dashboard and other APIs)
  const isProtectedPath = pathname === '/' || (pathname.startsWith('/api/') && !isPublicApi);

  if (isProtectedPath) {
    if (!token) {
      // No token found
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized: No session found' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      // Verify the JWT
      await jwtVerify(token, JWT_SECRET);
      return NextResponse.next();
    } catch (error) {
      // Token verification failed (expired or tampered)
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized: Session invalid or expired' }, { status: 401 });
      }
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('nexus_auth_token');
      return response;
    }
  }

  return NextResponse.next();
}

// Config to ensure proxy runs on all relevant paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (handled inside proxy)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
