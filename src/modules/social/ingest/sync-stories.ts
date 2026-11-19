import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { listStories } from '@/lib/meta/instagram';
import { resolveAccount } from './account';
import { loadPillarRules } from './rules';
import { snapshotMedia } from './snapshot';

/**
 * Catches stories before they vanish.
 *
 * Stories live 24 hours and their insights die with them, so unlike
 * everything else here this cannot be caught up later: a story nobody
 * asked about in time is simply gone. That is the whole reason this
 * runs on its own frequent schedule instead of riding along with the
 * nightly post sync.
 *
 * Deliberately small. It reads one endpoint and reuses the same
 * snapshot path as posts, so a story is an ordinary row with
 * `format: 'story'` and nothing downstream needs to know it is special.
 */

/** Stories expire in 24 hours; this leaves room for a missed run. */
const TIME_BUDGET_MS = 90_000;

export interface StorySyncResult {
  connected: boolean;
  live: number;
  written: number;
  metricRowsWritten: number;
  droppedMetrics: string[];
  errors: string[];
}

export async function syncStories(): Promise<StorySyncResult> {
  const result: StorySyncResult = {
    connected: false, live: 0, written: 0, metricRowsWritten: 0,
    droppedMetrics: [], errors: [],
  };

  const sb = createServiceClient();
  const account = await resolveAccount(sb);
  if (!account) return result;
  result.connected = true;

  let stories;
  try {
    stories = await listStories(account.token, account.igUserId);
  } catch (e) {
    result.errors.push(`Could not list stories: ${(e as Error).message}`);
    return result;
  }
  result.live = stories.length;
  if (stories.length === 0) return result;

  const rules = await loadPillarRules(sb);
  const snap = await snapshotMedia(sb, {
    token: account.token,
    accountId: account.accountId,
    media: stories,
    today: account.today,
    rules,
    pillarIdBySlug: account.pillarIdBySlug,
    deadline: Date.now() + TIME_BUDGET_MS,
  });

  result.written = snap.postsWritten;
  result.metricRowsWritten = snap.metricRowsWritten;
  result.droppedMetrics = snap.droppedMetrics;
  result.errors.push(...snap.errors);
  return result;
}
