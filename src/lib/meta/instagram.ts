import 'server-only';
import { GraphError, graphGet } from './graph';

/**
 * Instagram reads, in the shapes the connector wants rather than the
 * shapes Meta returns.
 *
 * The insights endpoints are the awkward part. Meta supports a different
 * metric list per media product type, refuses the whole request if one
 * metric in it doesn't apply, and hides a story's figures entirely when
 * they are below five. `tolerantInsights` deals with all three by
 * dropping what is refused and reporting what survived, so one odd post
 * can never fail a sync.
 */

export interface IgUser {
  id: string;
  username: string | null;
  followersCount: number;
  mediaCount: number;
}

export interface IgMedia {
  id: string;
  caption: string | null;
  mediaType: string | null;
  mediaProductType: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  timestamp: string;
  likeCount: number | null;
  commentsCount: number | null;
}

const USER_FIELDS = 'id,username,followers_count,media_count';
const MEDIA_FIELDS =
  'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count';

/** The account itself, including the only reliable follower total. */
export async function getIgUser(token: string, igUserId: string): Promise<IgUser> {
  const row = await graphGet<{
    id: string; username?: string; followers_count?: number; media_count?: number;
  }>(igUserId, { fields: USER_FIELDS }, token);

  return {
    id: row.id,
    username: row.username ?? null,
    followersCount: row.followers_count ?? 0,
    mediaCount: row.media_count ?? 0,
  };
}

/**
 * Works out which Instagram account a token belongs to.
 *
 * Tried in order because the answer depends on how the token was
 * minted: a Unified Login token resolves `/me` straight to the
 * Instagram user, while a Facebook Login token resolves it to a person
 * and the account hangs off one of their Pages.
 */
export async function discoverIgUserId(token: string): Promise<string | null> {
  try {
    const me = await graphGet<{ id?: string; username?: string }>(
      'me', { fields: 'id,username' }, token,
    );
    if (me.id && me.username) return me.id;
  } catch (e) {
    if (e instanceof GraphError && e.isAuthFailure) throw e;
  }

  try {
    const pages = await graphGet<{
      data?: Array<{ instagram_business_account?: { id?: string } }>;
    }>('me/accounts', { fields: 'instagram_business_account{id,username}', limit: 50 }, token);

    for (const page of pages.data ?? []) {
      const id = page.instagram_business_account?.id;
      if (id) return id;
    }
  } catch (e) {
    if (e instanceof GraphError && e.isAuthFailure) throw e;
  }

  return null;
}

/**
 * Every post back to `sinceIso`, newest first, following Meta's cursors.
 *
 * `limit` caps the walk so a first run on a sixteen-year-old account
 * can't sit in a serverless function until it is killed. The caller
 * pages again on the next run.
 */
export async function listMedia(
  token: string, igUserId: string, sinceIso: string | null, limit = 600,
): Promise<IgMedia[]> {
  const out: IgMedia[] = [];
  // Parsed once: Instagram stamps media "+0000" while a JS ISO string
  // ends in "Z", and comparing those two as text is only accidentally
  // correct.
  const cutoff = sinceIso ? Date.parse(sinceIso) : null;
  let path = `${igUserId}/media`;
  let params: Record<string, string | number | undefined> = { fields: MEDIA_FIELDS, limit: 50 };

  while (out.length < limit) {
    const page = await graphGet<{
      data?: Array<Record<string, unknown>>;
      paging?: { next?: string };
    }>(path, params, token);

    const rows = page.data ?? [];
    if (rows.length === 0) break;

    let reachedCutoff = false;
    for (const r of rows) {
      const timestamp = String(r.timestamp ?? '');
      if (!timestamp) continue;
      if (cutoff !== null && Date.parse(timestamp) < cutoff) { reachedCutoff = true; break; }
      out.push({
        id: String(r.id),
        caption: (r.caption as string | undefined) ?? null,
        mediaType: (r.media_type as string | undefined) ?? null,
        mediaProductType: (r.media_product_type as string | undefined) ?? null,
        permalink: (r.permalink as string | undefined) ?? null,
        thumbnailUrl:
          (r.thumbnail_url as string | undefined) ?? (r.media_url as string | undefined) ?? null,
        timestamp,
        likeCount: (r.like_count as number | undefined) ?? null,
        commentsCount: (r.comments_count as number | undefined) ?? null,
      });
    }

    if (reachedCutoff || !page.paging?.next) break;
    path = page.paging.next;
    params = {};
  }

  return out;
}

/** A metric name mapped to its total. Missing metrics are simply absent. */
export type InsightValues = Record<string, number>;

interface InsightRow {
  name?: string;
  values?: Array<{ value?: unknown }>;
  total_value?: { value?: unknown; breakdowns?: unknown };
}

function readRows(rows: InsightRow[]): InsightValues {
  const out: InsightValues = {};
  for (const row of rows) {
    if (!row.name) continue;
    const raw = row.total_value?.value ?? row.values?.[0]?.value;
    if (typeof raw === 'number') out[row.name] = raw;
  }
  return out;
}

/**
 * Reads what it can of a metric list and reports what it got.
 *
 * On a refusal it retries without the metrics Meta named, and if it
 * can't tell which one was at fault it falls back to asking for each
 * metric on its own. `rejected` comes back so the caller can remember
 * the bad ones and stop asking for them for the rest of the run.
 */
export async function tolerantInsights(
  token: string, path: string, metrics: string[],
  extra: Record<string, string | number | undefined> = {},
): Promise<{ values: InsightValues; rejected: string[] }> {
  if (metrics.length === 0) return { values: {}, rejected: [] };

  try {
    const res = await graphGet<{ data?: InsightRow[] }>(
      path, { metric: metrics.join(','), ...extra }, token,
    );
    return { values: readRows(res.data ?? []), rejected: [] };
  } catch (e) {
    if (!(e instanceof GraphError) || !e.isUnsupported) throw e;

    const named = metrics.filter((m) => e.message.includes(m));
    if (named.length > 0 && named.length < metrics.length) {
      const rest = metrics.filter((m) => !named.includes(m));
      const retry = await tolerantInsights(token, path, rest, extra);
      return { values: retry.values, rejected: [...named, ...retry.rejected] };
    }
  }

  const values: InsightValues = {};
  const rejected: string[] = [];
  for (const metric of metrics) {
    try {
      const res = await graphGet<{ data?: InsightRow[] }>(
        path, { metric, ...extra }, token,
      );
      Object.assign(values, readRows(res.data ?? []));
    } catch (e) {
      if (e instanceof GraphError && e.isUnsupported) rejected.push(metric);
      else throw e;
    }
  }
  return { values, rejected };
}

/**
 * One metric split by a dimension, as `{ DIMENSION_VALUE: number }`.
 *
 * Only used for reach by follow type, which is the single way to learn
 * how much of a day's reach came from people who don't follow the
 * account. Returns an empty object rather than throwing when the
 * breakdown isn't offered, because it routinely isn't on quiet days.
 */
export async function breakdownInsight(
  token: string, path: string, metric: string, dimension: string,
  extra: Record<string, string | number | undefined> = {},
): Promise<Record<string, number>> {
  let res: { data?: Array<{ total_value?: { breakdowns?: unknown } }> };
  try {
    res = await graphGet(
      path,
      { metric, breakdown: dimension, metric_type: 'total_value', ...extra },
      token,
    );
  } catch (e) {
    if (e instanceof GraphError && e.isUnsupported) return {};
    throw e;
  }

  const breakdowns = res.data?.[0]?.total_value?.breakdowns as
    | Array<{ results?: Array<{ dimension_values?: string[]; value?: number }> }>
    | undefined;

  const out: Record<string, number> = {};
  for (const b of breakdowns ?? []) {
    for (const r of b.results ?? []) {
      const key = r.dimension_values?.[0];
      if (key && typeof r.value === 'number') out[key.toUpperCase()] = r.value;
    }
  }
  return out;
}

/**
 * The account's currently live stories.
 *
 * Stories are not in `/media` and they are gone 24 hours after
 * publication, insights included. Nothing can recover a story that
 * expired before anyone asked about it, which is why this is polled
 * several times a day while posts are read once a night.
 *
 * Returns an empty list rather than throwing when the account has no
 * live stories, which is most of the time.
 */
export async function listStories(
  token: string, igUserId: string,
): Promise<IgMedia[]> {
  let page: { data?: Array<Record<string, unknown>> };
  try {
    page = await graphGet(`${igUserId}/stories`, { fields: MEDIA_FIELDS, limit: 50 }, token);
  } catch (e) {
    if (e instanceof GraphError && e.isUnsupported) return [];
    throw e;
  }

  return (page.data ?? [])
    .filter((r) => r.timestamp)
    .map((r) => ({
      id: String(r.id),
      caption: (r.caption as string | undefined) ?? null,
      mediaType: (r.media_type as string | undefined) ?? null,
      mediaProductType: (r.media_product_type as string | undefined) ?? 'STORY',
      permalink: (r.permalink as string | undefined) ?? null,
      thumbnailUrl:
        (r.thumbnail_url as string | undefined) ?? (r.media_url as string | undefined) ?? null,
      timestamp: String(r.timestamp),
      likeCount: (r.like_count as number | undefined) ?? null,
      commentsCount: (r.comments_count as number | undefined) ?? null,
    }));
}

/** The dimensions Instagram will break a follower count down by. */
export const DEMOGRAPHIC_DIMENSIONS = ['age', 'gender', 'country', 'city'] as const;
export type DemographicDimension = (typeof DEMOGRAPHIC_DIMENSIONS)[number];

/**
 * Who follows the account, by age, gender, country and city.
 *
 * A lifetime metric: it describes the audience as it stands, not a
 * day's change, so it is snapshotted rather than differenced. Instagram
 * withholds it entirely below roughly a hundred followers and caps each
 * dimension at its top entries, so a thin or missing dimension is
 * normal and never an error.
 */
export async function followerDemographics(
  token: string, igUserId: string, dimension: DemographicDimension,
  timeframe = 'this_month',
): Promise<Record<string, number>> {
  return breakdownInsight(
    token, `${igUserId}/insights`, 'follower_demographics', dimension,
    { period: 'lifetime', timeframe },
  );
}
