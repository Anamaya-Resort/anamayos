import 'server-only';
import { getSession } from '@/lib/session';

/**
 * Lets a route run either from a real logged-in session (accessLevel 5+,
 * the existing admin-only path) OR from Vercel Cron, which sends
 * `Authorization: Bearer <CRON_SECRET>` automatically once CRON_SECRET is
 * set as a project env var. No human has to click anything for a
 * cron-triggered sync to run -- that's the whole point of it existing.
 *
 * Returns 'session' | 'cron' | null so callers can e.g. skip per-user
 * rate limiting for cron calls (there's no session.user.id to key on).
 */
export async function checkCronOrSessionAuth(request: Request): Promise<'session' | 'cron' | null> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return 'cron';

  const session = await getSession();
  if (session?.accessLevel && session.accessLevel >= 5) return 'session';

  return null;
}
