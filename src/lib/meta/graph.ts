import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * The thin layer over Meta's Graph API: credentials, one GET, and the
 * error type everything else reasons about.
 *
 * Two things here are deliberate:
 *
 * 1. THE TOKEN IS READ FRESH, NEVER CACHED IN MODULE SCOPE. A sync is a
 *    one-shot job, and a token that has just been re-pasted after
 *    expiring must take effect on the next run, not after a redeploy.
 *
 * 2. GRAPH ERRORS ARE TYPED, NOT STRINGS. Meta answers "this metric
 *    doesn't exist for this media type" and "you are rate limited" with
 *    the same HTTP 400, distinguished only by `code`. The connector
 *    skips the first and waits out the second, so the difference has to
 *    survive as far as the caller.
 */

/** Pinned explicitly: a Graph version falls out of support on a schedule. */
export const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? 'v27.0';

const GRAPH_HOST = 'https://graph.facebook.com';

/** Meta's throttling codes, plus the transient server ones. */
const RETRYABLE = new Set([1, 2, 4, 17, 32, 341, 613]);

export class GraphError extends Error {
  readonly code: number;
  readonly subcode: number | null;
  readonly status: number;
  readonly traceId: string | null;

  constructor(
    message: string,
    opts: { code?: number; subcode?: number | null; status?: number; traceId?: string | null } = {},
  ) {
    super(message);
    this.name = 'GraphError';
    this.code = opts.code ?? 0;
    this.subcode = opts.subcode ?? null;
    this.status = opts.status ?? 0;
    this.traceId = opts.traceId ?? null;
  }

  /** Worth another attempt after a pause. */
  get isRetryable(): boolean {
    return this.status >= 500 || RETRYABLE.has(this.code);
  }

  /**
   * "You asked for something that doesn't apply here" rather than
   * "something went wrong". Code 100 is Meta's catch-all for an
   * unsupported metric on a given media type; code 10 is a story whose
   * figures are too small to disclose.
   */
  get isUnsupported(): boolean {
    return this.code === 100 || this.code === 10;
  }

  /** The token is dead or was revoked. Nothing retries past this. */
  get isAuthFailure(): boolean {
    return this.code === 190 || this.code === 102 || this.code === 463;
  }
}

export interface MetaCredentials {
  accessToken: string;
  /** The Instagram Business account id, when one has been saved. */
  igUserId: string | null;
}

/**
 * The stored Meta credentials, or null when the account has never been
 * connected. Callers treat null as "not connected yet", never an error:
 * the dashboard has to keep rendering sample data without throwing.
 *
 * An env var wins over the database so a deployment can be pointed at a
 * different account without touching stored state.
 */
export async function getMetaCredentials(): Promise<MetaCredentials | null> {
  const sb = createServiceClient();

  const [{ data: secret }, { data: setting }] = await Promise.all([
    sb.from('marketing_secrets')
      .select('secret_value')
      .eq('platform_key', 'instagram')
      .eq('secret_key', 'access_token')
      .maybeSingle(),
    sb.from('marketing_settings')
      .select('setting_value')
      .eq('platform_key', 'instagram')
      .eq('setting_key', 'instagram_account_id')
      .maybeSingle(),
  ]);

  const accessToken = process.env.META_ACCESS_TOKEN || (secret?.secret_value as string | undefined);
  if (!accessToken) return null;

  const igUserId =
    process.env.META_IG_USER_ID || (setting?.setting_value as string | undefined) || null;

  return { accessToken, igUserId };
}

/** Saves the token and the account id the connect flow discovered. */
export async function storeMetaCredentials(
  accessToken: string, igUserId: string | null, personId: string | null,
): Promise<void> {
  const sb = createServiceClient();
  const now = new Date().toISOString();

  await sb.from('marketing_secrets').upsert(
    {
      platform_key: 'instagram',
      secret_key: 'access_token',
      secret_value: accessToken,
      last4: accessToken.slice(-4),
      label: 'Instagram reporting token',
      updated_by: personId,
      updated_at: now,
    },
    { onConflict: 'platform_key,secret_key' },
  );

  if (igUserId) {
    await sb.from('marketing_settings').upsert(
      {
        platform_key: 'instagram',
        setting_key: 'instagram_account_id',
        setting_value: igUserId,
        updated_by: personId,
        updated_at: now,
      },
      { onConflict: 'platform_key,setting_key' },
    );
  }
}

type Params = Record<string, string | number | undefined>;

/**
 * One Graph read, with backoff on the transient failures.
 *
 * `path` is everything after the version, with no leading slash, e.g.
 * `17841400689317448/media`. A full URL is passed through untouched so
 * paging cursors can be followed as given.
 */
export async function graphGet<T>(
  path: string, params: Params, token: string, attempt = 0,
): Promise<T> {
  const isAbsolute = path.startsWith('https://');
  const url = isAbsolute
    ? new URL(path)
    : new URL(`${GRAPH_HOST}/${GRAPH_VERSION}/${path}`);

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }
  if (!url.searchParams.has('access_token')) {
    url.searchParams.set('access_token', token);
  }

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    if (attempt < 2) {
      await sleep(1500 * (attempt + 1));
      return graphGet<T>(path, params, token, attempt + 1);
    }
    throw new GraphError(`Network failure calling Graph: ${(e as Error).message}`);
  }

  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
  };

  if (json.error || !res.ok) {
    const err = new GraphError(json.error?.message ?? `Graph returned ${res.status}`, {
      code: json.error?.code,
      subcode: json.error?.error_subcode ?? null,
      status: res.status,
      traceId: json.error?.fbtrace_id ?? null,
    });
    if (err.isRetryable && attempt < 3) {
      await sleep(2000 * 2 ** attempt);
      return graphGet<T>(path, params, token, attempt + 1);
    }
    throw err;
  }

  return json as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
