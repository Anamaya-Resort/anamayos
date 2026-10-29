import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { GA4_SCOPE, GSC_SCOPE, getGoogleToken, hasGoogleCredential } from '@/lib/google/auth';
import type { DashRange, MarketingSite, SiteMetrics } from './types';

/**
 * Website traffic and search performance per registered site.
 *
 * One GA4 property reports every subdomain that carries the same gtag, and a
 * Search Console DOMAIN property covers every subdomain, so a new subdomain
 * usually needs no new property — only a filter. `ga4_hostname` filters the
 * GA4 hostName dimension and `gsc_page_filter` filters Search Console pages
 * by URL, which is how one property is sliced into several rows here.
 */

export async function getSites(includeInactive = false): Promise<MarketingSite[]> {
  const sb = createServiceClient();
  let q = sb.from('marketing_sites')
    .select('id, domain, label, ga4_property_id, ga4_hostname, gsc_property, gsc_page_filter, is_primary, is_active, sort_order, notes')
    .order('sort_order');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data } = await q;
  return (data ?? []) as MarketingSite[];
}

export async function getSiteMetrics(range: DashRange): Promise<SiteMetrics[]> {
  const sites = await getSites();
  if (sites.length === 0) return [];

  const connected = await hasGoogleCredential();
  if (!connected) {
    return sites.map((site) => blank(site, 'noCredential'));
  }

  const [gaToken, gscToken] = await Promise.all([
    getGoogleToken(GA4_SCOPE),
    getGoogleToken(GSC_SCOPE),
  ]);

  return Promise.all(sites.map(async (site) => {
    const [ga, gsc] = await Promise.all([
      gaToken ? fetchGa4(site, range, gaToken) : null,
      gscToken ? fetchGsc(site, range, gscToken) : null,
    ]);
    return {
      site,
      sessions: ga?.sessions ?? null,
      users: ga?.users ?? null,
      conversions: ga?.conversions ?? null,
      clicks: gsc?.clicks ?? null,
      impressions: gsc?.impressions ?? null,
      position: gsc?.position ?? null,
      blockedBy: ga || gsc ? undefined : 'noCredential',
    };
  }));
}

function blank(site: MarketingSite, blockedBy: string): SiteMetrics {
  return {
    site, sessions: null, users: null, conversions: null,
    clicks: null, impressions: null, position: null, blockedBy,
  };
}

async function fetchGa4(site: MarketingSite, range: DashRange, token: string) {
  if (!site.ga4_property_id) return null;

  const body: Record<string, unknown> = {
    dateRanges: [{ startDate: range.from, endDate: range.to }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'conversions' }],
  };
  if (site.ga4_hostname) {
    body.dimensionFilter = {
      filter: {
        fieldName: 'hostName',
        stringFilter: { matchType: 'EXACT', value: site.ga4_hostname },
      },
    };
  }

  const json = await call<{ rows?: { metricValues: { value: string }[] }[] }>(
    `https://analyticsdata.googleapis.com/v1beta/properties/${site.ga4_property_id}:runReport`,
    token, body);
  const values = json?.rows?.[0]?.metricValues;
  if (!values) return null;
  return {
    sessions: Number(values[0]?.value ?? 0),
    users: Number(values[1]?.value ?? 0),
    conversions: Number(values[2]?.value ?? 0),
  };
}

async function fetchGsc(site: MarketingSite, range: DashRange, token: string) {
  if (!site.gsc_property) return null;

  // Search Console data lags about two days; asking for today returns zeros
  // and makes a healthy site look dead.
  const end = new Date(Math.min(
    new Date(range.to).getTime(),
    Date.now() - 2 * 86400000,
  ));
  const endIso = end.toISOString().slice(0, 10);
  if (endIso < range.from) return null;

  const body: Record<string, unknown> = {
    startDate: range.from,
    endDate: endIso,
    dimensions: [],
  };
  // Applying a page filter switches Search Console's aggregation from
  // byProperty to byPage, so a filtered subdomain row is counted on a
  // different basis from the unfiltered domain row and the two do not sum.
  // Measured on anamaya.com: whole domain 54,935 impressions, page-contains
  // www.anamaya.com 69,434. The table footnote says so.
  if (site.gsc_page_filter) {
    body.dimensionFilterGroups = [{
      filters: [{ dimension: 'page', operator: 'contains', expression: site.gsc_page_filter }],
    }];
  }

  const json = await call<{
    rows?: { clicks: number; impressions: number; position: number }[];
  }>(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site.gsc_property)}/searchAnalytics/query`,
    token, body);
  const row = json?.rows?.[0];
  if (!row) return { clicks: 0, impressions: 0, position: null };
  return {
    clicks: Math.round(row.clicks),
    impressions: Math.round(row.impressions),
    position: Number(row.position.toFixed(1)),
  };
}

/**
 * A failing site returns null rather than throwing, so one misconfigured
 * property cannot blank the whole dashboard.
 */
async function call<T>(url: string, token: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
