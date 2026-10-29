import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/config/sso';
import { unsealSession } from '@/lib/session-edge';

/**
 * Route protection based on the SSO session cookie.
 * No Supabase Auth — session is managed via the LightningWorks SSO.
 *
 * This is DEFAULT-DENY: anything not named below needs a session. It used
 * to protect only paths starting with `/dashboard`, which meant any page
 * added at a new top-level path was public by accident. `/smm_tracking`
 * was exactly that, and it served live revenue figures to anyone.
 *
 * API routes are excluded because each one checks the session itself and
 * must answer 401/403 as JSON rather than be redirected to an HTML login.
 */
const PUBLIC_PREFIXES = ['/login', '/auth', '/api'] as const;

function isPublic(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function protectRoutes(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  let isAuthenticated = false;

  if (sessionCookie) {
    const session = await unsealSession(sessionCookie);
    isAuthenticated = !!session;
  }

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth');

  // Unauthenticated users on anything protected → login, remembering where
  // they were headed so the SSO round trip lands them back on it.
  if (!isAuthenticated && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    if (pathname !== '/') url.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Authenticated users on auth pages → dashboard
  if (isAuthenticated && isAuthRoute && !pathname.startsWith('/auth/callback')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
