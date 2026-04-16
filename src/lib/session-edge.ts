import { unsealData } from 'iron-session';
import { SESSION_MAX_AGE_S } from '@/config/sso';
import type { SessionData } from '@/types/sso';

function getSessionPassword(): string {
  const pw = process.env.SESSION_SECRET;
  if (!pw || pw.length < 32) {
    throw new Error('SESSION_SECRET env var must be at least 32 characters');
  }
  return pw;
}

/** Unseal a session from a raw cookie value (for middleware/edge runtime) */
export async function unsealSession(sealed: string): Promise<SessionData | null> {
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
