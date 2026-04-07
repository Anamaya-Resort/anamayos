import { NextResponse } from 'next/server';
import { getSSOVerifyUrl } from '@/config/sso';
import { createSessionValue, sessionCookieOptions } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { SSOVerifyResponse } from '@/types/sso';

/**
 * POST /api/auth/verify
 * Verifies SSO token, upserts person, queries roles, creates session.
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
    const supabase = createServiceClient();

    // Upsert person (not profile) using auth_user_id as conflict key
    let personId: string = user.id;
    try {
      const { data: person } = await supabase
        .from('persons')
        .upsert(
          {
            auth_user_id: user.id,
            email: user.email,
            full_name: user.display_name || user.username || null,
            avatar_url: user.avatar_url,
          },
          { onConflict: 'auth_user_id' },
        )
        .select('id')
        .single();

      if (person) personId = person.id;
    } catch {
      // Upsert failure is non-fatal — use SSO user ID as fallback
    }

    // Query active roles for this person
    let roleSlugs: string[] = [];
    let accessLevel = 1;
    try {
      const { data: roles } = await supabase
        .from('person_roles')
        .select('status, starts_at, ends_at, roles(slug, access_level)')
        .eq('person_id', personId)
        .eq('status', 'active');

      if (roles && roles.length > 0) {
        const now = new Date().toISOString().split('T')[0];
        const activeRoles = roles.filter((r: Record<string, unknown>) => {
          const starts = r.starts_at as string;
          const ends = r.ends_at as string | null;
          return starts <= now && (!ends || ends >= now);
        });

        roleSlugs = activeRoles
          .map((r: Record<string, unknown>) => {
            const role = r.roles as { slug: string; access_level: number } | null;
            return role?.slug;
          })
          .filter(Boolean) as string[];

        accessLevel = Math.max(
          1,
          ...activeRoles.map((r: Record<string, unknown>) => {
            const role = r.roles as { slug: string; access_level: number } | null;
            return role?.access_level ?? 1;
          }),
        );
      }

      // If no roles, create default guest role
      if (roleSlugs.length === 0) {
        const { data: guestRole } = await supabase
          .from('roles')
          .select('id')
          .eq('slug', 'guest')
          .single();

        if (guestRole) {
          await supabase.from('person_roles').insert({
            person_id: personId,
            role_id: guestRole.id,
            status: 'active',
          });
          roleSlugs = ['guest'];
          accessLevel = 1;
        }
      }
    } catch {
      // Role query failure — default to guest
      roleSlugs = ['guest'];
      accessLevel = 1;
    }

    // Create session cookie with enriched data
    const sessionValue = createSessionValue(user, personId, accessLevel, roleSlugs);
    const response = NextResponse.json({
      success: true,
      user,
      personId,
      accessLevel,
      roleSlugs,
    });

    response.cookies.set('ao_session', sessionValue, sessionCookieOptions);

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 },
    );
  }
}
