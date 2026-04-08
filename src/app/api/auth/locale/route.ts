import { NextResponse } from 'next/server';
import { getSession, createSessionValue, sessionCookieOptions } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { SESSION_COOKIE } from '@/config/sso';
import { locales } from '@/config/app';

/**
 * POST /api/auth/locale
 * Updates the user's preferred language in the DB and refreshes the session cookie.
 */
export async function POST(request: Request) {
  try {
    const { locale } = await request.json();

    if (!locale || !locales.includes(locale)) {
      return NextResponse.json({ success: false, error: 'Invalid locale' }, { status: 400 });
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    // Update preferred_language in the DB
    try {
      const supabase = createServiceClient();
      await supabase
        .from('persons')
        .update({ preferred_language: locale })
        .eq('id', session.personId);
    } catch {
      // DB update failure is non-fatal
    }

    // Rebuild session cookie with new locale
    const newSessionValue = createSessionValue(
      session.user,
      session.personId,
      session.accessLevel,
      session.roleSlugs,
      locale,
    );

    const response = NextResponse.json({ success: true, locale });
    response.cookies.set(SESSION_COOKIE, newSessionValue, sessionCookieOptions);
    return response;
  } catch {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
