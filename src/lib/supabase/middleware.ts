import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/config/sso';
import { unsealSession } from '@/lib/session-edge';

/**
 * Middleware for route protection based on SSO session cookie.
 * No Supabase Auth — session is managed via the LightningWorks SSO.
 */
export async function protectRoutes(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  let isAuthenticated = false;

  if (sessionCookie) {
    const session = await unsealSession(sessionCookie);
    isAuthenticated = !!session;
  }

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth');
  const isDashboardRoute = pathname.startsWith('/dashboard');

  // Unauthenticated users trying to access protected routes → redirect to login
  if (!isAuthenticated && isDashboardRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Authenticated users on auth pages → redirect to dashboard
  if (isAuthenticated && isAuthRoute && !pathname.startsWith('/auth/callback')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
