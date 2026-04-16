import { NextResponse } from 'next/server';
import { getSession, createSessionValue, sessionCookieOptions } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { SESSION_COOKIE } from '@/config/sso';
import { locales } from '@/config/app';
import { localeSchema } from '@/lib/api-schemas';
import { validationError, serverError } from '@/lib/api-utils';

/**
 * POST /api/auth/locale
 * Updates the user's preferred language in the DB and refreshes the session cookie.
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = localeSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues);
    }

    const { locale } = parsed.data;

    if (!locales.includes(locale as typeof locales[number])) {
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
    const newSessionValue = await createSessionValue(
      session.user,
      session.personId,
      session.accessLevel,
      session.roleSlugs,
      locale,
    );

    const response = NextResponse.json({ success: true, locale });
    response.cookies.set(SESSION_COOKIE, newSessionValue, sessionCookieOptions);
    return response;
  } catch (err) {
    return serverError(err);
  }
}
