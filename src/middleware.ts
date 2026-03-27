import { NextRequest, NextResponse } from 'next/server';

/**
 * Lightweight auth middleware — checks cookie presence only.
 * Token validity is verified in the API routes themselves.
 * Also sets an anonymous session cookie for unauthenticated users.
 */

const AUTH_PAGES = ['/login', '/signup'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = request.cookies.has('access_token');

  // Redirect authenticated users away from auth pages to home
  if (hasToken && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const response = NextResponse.next();

  // For unauthenticated users, ensure an anonymous_session cookie exists
  // so API routes can identify anonymous chat ownership.
  if (!hasToken && !request.cookies.has('anonymous_session')) {
    const sessionId = crypto.randomUUID();
    response.cookies.set('anonymous_session', sessionId, {
      httpOnly: false, // Client-side JS needs to read this for localStorage sync
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - api/auth/* (auth API routes handle their own logic)
     */
    '/((?!_next|favicon\\.ico|sitemap\\.xml|robots\\.txt|api/auth).*)',
  ],
};
