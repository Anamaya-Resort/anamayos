import { type NextRequest } from 'next/server';
import { protectRoutes } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return protectRoutes(request);
}

/**
 * Skip Next's internals and anything that looks like a static file.
 *
 * The file-extension rule matters now that route protection is
 * default-deny: the old matcher only listed image extensions, so
 * `/sounds/button_tone_1-1.mp3` (the click sound, initialised from the
 * root layout and used on the login page itself) would have been
 * redirected to /login and failed to load.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.[A-Za-z0-9]{2,5}$).*)',
  ],
};
