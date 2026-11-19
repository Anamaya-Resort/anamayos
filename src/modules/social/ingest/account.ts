import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getMetaCredentials, storeMetaCredentials } from '@/lib/meta/graph';
import { discoverIgUserId, getIgUser, type IgUser } from '@/lib/meta/instagram';
import { ensureAccount } from './upsert';

/**
 * Everything both syncs need before they can do anything: a token, the
 * account it belongs to, and what "today" means for that account.
 *
 * Shared so the nightly post run and the frequent stories run cannot
 * drift into disagreeing about which account they are writing to.
 */

/** Anamaya posts and reads its numbers in Costa Rica. */
export const DEFAULT_TIMEZONE = 'America/Costa_Rica';

export interface ResolvedAccount {
  token: string;
  igUserId: string;
  accountId: string;
  timeZone: string;
  today: string;
  user: IgUser;
  pillarIdBySlug: Map<string, string>;
}

/** Today's date in the account's own timezone, as YYYY-MM-DD. */
export function todayIn(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Null when no token is saved. Callers treat that as "not connected
 * yet", never as a failure: it is the normal state before the account
 * is linked, and a red cron would be noise.
 */
export async function resolveAccount(
  sb: SupabaseClient,
): Promise<ResolvedAccount | null> {
  const creds = await getMetaCredentials();
  if (!creds) return null;

  let igUserId = creds.igUserId;
  if (!igUserId) {
    igUserId = await discoverIgUserId(creds.accessToken);
    if (!igUserId) {
      throw new Error(
        'The token works but no Instagram Business account hangs off it. '
        + 'Save the account id in the marketing connections panel.',
      );
    }
    await storeMetaCredentials(creds.accessToken, igUserId, null);
  }

  const user = await getIgUser(creds.accessToken, igUserId);

  const accountId = await ensureAccount(sb, {
    platform: 'instagram',
    externalId: igUserId,
    handle: user.username,
    label: user.username ? `@${user.username}` : 'Instagram',
    timezone: DEFAULT_TIMEZONE,
  });

  const [{ data: accountRow }, { data: pillarRows }] = await Promise.all([
    sb.from('social_accounts').select('timezone').eq('id', accountId).maybeSingle(),
    sb.from('content_pillars').select('id, slug').eq('is_active', true),
  ]);

  const timeZone = (accountRow?.timezone as string | undefined) ?? DEFAULT_TIMEZONE;

  return {
    token: creds.accessToken,
    igUserId,
    accountId,
    timeZone,
    today: todayIn(timeZone),
    user,
    pillarIdBySlug: new Map(
      (pillarRows ?? []).map((p) => [p.slug as string, p.id as string]),
    ),
  };
}
