import { NextResponse } from 'next/server';
import { getSSOVerifyUrl } from '@/config/sso';
import { createSessionValue, sessionCookieOptions } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyTokenSchema } from '@/lib/api-schemas';
import { validationError } from '@/lib/api-utils';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import type { SSOVerifyResponse } from '@/types/sso';

/**
 * POST /api/auth/verify
 * Verifies SSO token, upserts person, queries roles, creates session.
 */
export async function POST(request: Request) {
  try {
    // Rate limit: 10 attempts per minute per IP
    const clientKey = getClientKey(request);
    if (!checkRateLimit(`auth:verify:${clientKey}`, { limit: 10, windowSeconds: 60 })) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON' },
        { status: 400 },
      );
    }

    const parsed = verifyTokenSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues);
    }

    const { access_token: accessToken } = parsed.data;

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

    // Resolve the person. IMPORTANT: do NOT clobber a user-edited
    // full_name/avatar on every login — only seed them on first
    // insert. An upsert here would overwrite the profile each login.
    let personId: string = user.id;
    let locale: string = 'en';
    let personFullName: string | null = null;
    try {
      const { data: existing } = await supabase
        .from('persons')
        .select('id, preferred_language, full_name')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (existing) {
        personId = existing.id;
        const row = existing as Record<string, unknown>;
        locale = typeof row.preferred_language === 'string' ? row.preferred_language : 'en';
        personFullName = (row.full_name as string | null) ?? null;
        // touch email only — preserve user-edited name/avatar
        await supabase
          .from('persons')
          .update({ email: user.email })
          .eq('id', existing.id);
      } else {
        const { data: created } = await supabase
          .from('persons')
          .insert({
            auth_user_id: user.id,
            email: user.email,
            full_name: user.display_name || user.username || null,
            avatar_url: user.avatar_url,
          })
          .select('id, preferred_language, full_name')
          .single();
        if (created) {
          personId = created.id;
          const row = created as Record<string, unknown>;
          locale = typeof row.preferred_language === 'string' ? row.preferred_language : 'en';
          personFullName = (row.full_name as string | null) ?? null;
        }
      }
    } catch {
      // Non-fatal — fall back to SSO user id
    }

    // Query active roles for this person
    let roleSlugs: string[] = [];
    let accessLevel = 1;
    let topRole = '';
    try {
      const { data: roles } = await supabase
        .from('person_roles')
        .select('status, starts_at, ends_at, roles(slug, access_level, name)')
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

        let topLevel = 0;
        for (const r of activeRoles) {
          const role = (r as Record<string, unknown>).roles as
            | { slug: string; access_level: number; name: string }
            | null;
          if (role && role.access_level > topLevel) {
            topLevel = role.access_level;
            topRole = role.name || role.slug;
          }
        }
        accessLevel = Math.max(1, topLevel);
      }

      // If SSO user is superadmin, ensure they have the superadmin role in our DB
      if (user.role === 'superadmin' && !roleSlugs.includes('superadmin')) {
        const { data: saRole } = await supabase
          .from('roles').select('id').eq('slug', 'superadmin').single();
        if (saRole) {
          await supabase.from('person_roles').upsert(
            { person_id: personId, role_id: saRole.id, status: 'active', starts_at: new Date().toISOString().split('T')[0] },
            { onConflict: 'person_id,role_id' },
          );
          roleSlugs.push('superadmin');
          if (7 >= accessLevel) {
            accessLevel = 7;
            topRole = 'Superadmin';
          }
        }
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
          topRole = 'Guest';
        }
      }
    } catch {
      // Role query failure — default to guest
      roleSlugs = ['guest'];
      accessLevel = 1;
      topRole = 'Guest';
    }

    const displayName =
      personFullName || user.display_name || user.username || user.email;

    // Create sealed session cookie
    const sessionValue = await createSessionValue(
      user,
      personId,
      accessLevel,
      roleSlugs,
      locale,
      displayName,
      topRole,
    );
    const response = NextResponse.json({
      success: true,
      user,
      personId,
      displayName,
      topRole,
      accessLevel,
      roleSlugs,
      locale,
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
