/**
 * In-memory sliding-window rate limiter.
 * Suitable for single-instance Vercel deployments.
 * For multi-region, replace with Upstash or similar.
 */

interface Entry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Entry>();

// Evict stale entries every 60s to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(key);
  }
}, 60_000);

export interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

/** Returns true if the request should be allowed, false if rate-limited */
export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + config.windowSeconds * 1000 });
    return true;
  }

  entry.count++;
  return entry.count <= config.limit;
}

/** Extract a client identifier from headers (IP-based) */
export function getClientKey(request: Request): string {
  const headers = new Headers(request.headers);
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
