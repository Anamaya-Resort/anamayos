import { cookies } from 'next/headers';
import { sealData, unsealData } from 'iron-session';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  SESSION_MAX_AGE_MS,
} from '@/config/sso';
import type { SSOUser, SessionData } from '@/types/sso';

function getSessionPassword(): string {
  const pw = process.env.SESSION_SECRET;
  if (!pw || pw.length < 32) {
    throw new Error('SESSION_SECRET env var must be at least 32 characters');
  }
  return pw;
}

/** Read the current session from cookies (server-side) */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sealed) return null;

  try {
    const session = await unsealData<SessionData>(sealed, {
      password: getSessionPassword(),
      ttl: SESSION_MAX_AGE_S,
    });
    if (!session?.user?.id) return null;
    if (Date.now() > session.expiresAt) return null;
    return session;
  } catch {
    return null;
  }
}

/** Get the current user from the session (server-side) */
export async function getSessionUser(): Promise<SSOUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

/** Get the person ID from the session */
export async function getSessionPersonId(): Promise<string | null> {
  const session = await getSession();
  return session?.personId ?? null;
}

/** Get the access level from the session (1-6) */
export async function getSessionAccessLevel(): Promise<number> {
  const session = await getSession();
  return session?.accessLevel ?? 0;
}

/** Get the role slugs from the session */
export async function getSessionRoles(): Promise<string[]> {
  const session = await getSession();
  return session?.roleSlugs ?? [];
}

/** Get the locale from the session */
export async function getSessionLocale(): Promise<string> {
  const session = await getSession();
  return session?.locale ?? 'en';
}

/** Create a sealed session cookie value */
export async function createSessionValue(
  user: SSOUser,
  personId: string,
  accessLevel: number,
  roleSlugs: string[],
  locale: string = 'en',
): Promise<string> {
  const session: SessionData = {
    user,
    personId,
    accessLevel,
    roleSlugs,
    locale,
    expiresAt: Date.now() + SESSION_MAX_AGE_MS,
  };
  return sealData(session, {
    password: getSessionPassword(),
    ttl: SESSION_MAX_AGE_S,
  });
}

/** Cookie options for the session */
export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: SESSION_MAX_AGE_S,
  path: '/',
};
