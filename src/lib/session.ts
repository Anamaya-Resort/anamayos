import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  SESSION_MAX_AGE_MS,
} from '@/config/sso';
import type { SSOUser, SessionData } from '@/types/sso';

/** Read the current session from cookies (server-side) */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    const session: SessionData = JSON.parse(raw);
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

/** Create a session cookie value */
export function createSessionValue(
  user: SSOUser,
  personId: string,
  accessLevel: number,
  roleSlugs: string[],
): string {
  const session: SessionData = {
    user,
    personId,
    accessLevel,
    roleSlugs,
    expiresAt: Date.now() + SESSION_MAX_AGE_MS,
  };
  return JSON.stringify(session);
}

/** Cookie options for the session */
export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: SESSION_MAX_AGE_S,
  path: '/',
};
