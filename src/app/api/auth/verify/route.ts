import { NextResponse } from 'next/server';
import { getSSOVerifyUrl } from '@/config/sso';
import { createSessionValue, sessionCookieOptions } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { SSOVerifyResponse } from '@/types/sso';

/**
 * POST /api/auth/verify
 * Receives the SSO access_token from the callback page,
 * verifies it with the SSO portal, creates a local session,
 * and upserts the user profile into Supabase.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accessToken = body.access_token;

    if (!accessToken || typeof accessToken !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing access_token' },
        { status: 400 },
      );
    }

    // Verify token with SSO
    const ssoRes = await fetch(getSSOVerifyUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: accessToken }),
    });

    if (!ssoRes.ok) {
      return NextResponse.json(
        { success: false, error: 'Token verification failed' },
        { status: 401 },
      );
    }

    const ssoData: SSOVerifyResponse = await ssoRes.json();

    if ('error' in ssoData) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 },
      );
    }

    const { user } = ssoData;

    // Upsert user profile into Supabase (using service role — server only)
    try {
      const supabase = createServiceClient();
      await supabase.from('profiles').upsert(
        {
          id: user.id,
          email: user.email,
          full_name: user.display_name || user.username || null,
          role: mapSSORole(user.role),
          avatar_url: user.avatar_url,
        },
        { onConflict: 'id' },
      );
    } catch {
      // Profile upsert failure is non-fatal — session still works
    }

    // Create session cookie
    const sessionValue = createSessionValue(user);
    const response = NextResponse.json({ success: true, user });

    response.cookies.set('ao_session', sessionValue, sessionCookieOptions);

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 },
    );
  }
}

/** Map SSO roles to local app roles */
function mapSSORole(ssoRole: string): string {
  switch (ssoRole) {
    case 'superadmin':
      return 'owner';
    case 'admin':
      return 'admin';
    default:
      return 'guest';
  }
}
