import 'server-only';
import type { GreenAirConfig, SearchParams, SearchResult } from './types';
import { parseConfig, parseResults } from './parse';

/**
 * Reads Green Airways' public booking engine (TTinteractive "Zenith") the same
 * way their own search page does: open a search, then ask for the flight list.
 * Plain web requests, no browser. Two calls, about 5 seconds.
 *
 * If they ever put an anti-bot check in front of it we stop (BlockedError),
 * we never try to get around it.
 */
const BASE = 'https://fo-latam.ttinteractive.com';
const APP = `${BASE}/Zenith/FrontOffice/CostaRicaGReenAirways/en-gb`;
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const ANTIFRAUD = '<!--antifraud-->';

export class BlockedError extends Error {}

/** Built-in copy of their network, used only if their page can't be read. */
export const FALLBACK_CONFIG: GreenAirConfig = {
  airports: [
    { code: 'SJO', name: 'San José (Juan Santamaría)', dataId: 11196 },
    { code: 'ACO', name: 'Cóbano', dataId: 24726 },
    { code: 'LIR', name: 'Liberia', dataId: 9055 },
    { code: 'NOB', name: 'Nosara Beach', dataId: 10041 },
    { code: 'PJM', name: 'Puerto Jiménez', dataId: 10868 },
    { code: 'XQP', name: 'Quepos', dataId: 12873 },
  ],
  routes: {
    ACO: ['LIR', 'SJO'],
    LIR: ['ACO', 'NOB'],
    NOB: ['LIR', 'SJO'],
    PJM: ['SJO'],
    SJO: ['ACO', 'NOB', 'PJM', 'XQP'],
    XQP: ['SJO'],
  },
};

/** Fetch that follows redirects by hand so cookies set along the way are kept. */
async function fetchKeep(url: string, jar: Map<string, string>, init: RequestInit = {}) {
  let current = url;
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(current, {
      ...init,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'en-GB,en;q=0.9',
        ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
        ...(init.headers ?? {}),
      },
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, current).toString();
      init = { headers: init.headers }; // redirects continue as GET
      continue;
    }
    return { res, url: current };
  }
  throw new Error('Too many redirects from Green Airways');
}

export async function readConfig(): Promise<GreenAirConfig> {
  const { res } = await fetchKeep(APP, new Map());
  if (!res.ok) throw new Error(`Green Airways said ${res.status}`);
  return parseConfig(await res.text()) ?? FALLBACK_CONFIG;
}

function criteria(p: SearchParams, cfg: GreenAirConfig) {
  const id = (code: string) => {
    const a = cfg.airports.find((x) => x.code === code);
    if (!a) throw new Error(`Unknown airport ${code}`);
    return a.dataId;
  };
  const leg = (from: string, to: string, date: string) => ({
    IsOpen: false,
    DataIdOrigin: id(from),
    DataIdDestination: id(to),
    DateTime: `${date}T00:00:00`,
  });
  const legs = [leg(p.from, p.to, p.depart)];
  if (p.return) legs.push(leg(p.to, p.from, p.return));
  return {
    OriginDestinations: legs,
    TravelerTypes: [{ DataId: 1, TravelerCount: p.adults }],
    Currency: { Code: 'USD' },
    ExtendedSearchDayCount: 3,
    TripType: p.return ? 1 : 0,
    ReservedSSR: [],
  };
}

/** The link guests use to book: the same search, opened on Green Airways' own site. */
export function bookingUrl(p: SearchParams, cfg: GreenAirConfig): string {
  const url = `${APP}/BookingEngine/SearchFlights?json=${encodeURIComponent(JSON.stringify(criteria(p, cfg)))}`;
  // If Green Airways gives us a partner or tracking code, it goes in this one setting
  // (e.g. GREENAIR_PARTNER_QUERY="agency=anamaya") and every booking link carries it.
  const extra = (process.env.GREENAIR_PARTNER_QUERY ?? '').trim().replace(/^[?&]/, '');
  return extra ? `${url}&${extra}` : url;
}

/** jQuery-style form encoding, which is what their page sends. */
function formEncode(obj: unknown, prefix = '', out: [string, string][] = []): [string, string][] {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => formEncode(v, `${prefix}[${v !== null && typeof v === 'object' ? i : ''}]`, out));
  } else if (obj !== null && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) formEncode(v, prefix ? `${prefix}[${k}]` : k, out);
  } else {
    out.push([prefix, obj === null || obj === undefined ? '' : String(obj)]);
  }
  return out;
}

export async function searchFlights(p: SearchParams, cfg: GreenAirConfig): Promise<SearchResult> {
  const jar = new Map<string, string>();
  const crit = criteria(p, cfg);
  const first = await fetchKeep(
    `${APP}/BookingEngine/SearchFlights?json=${encodeURIComponent(JSON.stringify(crit))}`,
    jar,
  );
  if (!first.res.ok) throw new Error(`Green Airways said ${first.res.status}`);
  // (This page always mentions the anti-fraud marker in its own script, so only
  // the flight list below is checked for it.)
  const page = await first.res.text();

  const vm = page.match(/var viewModel = (\{[\s\S]*?\});\s*\n/)?.[1];
  const token = page.match(/name="__RequestVerificationToken" type="hidden" value="([^"]+)"/)?.[1];
  const listUrl = page.match(/url: "([^"]+FlexibleFlightListLoadSelectedDays[^"]+)"/)?.[1];
  if (!vm || !token || !listUrl) throw new Error('Green Airways page changed (search step)');

  const body = new URLSearchParams(formEncode(JSON.parse(vm))).toString();
  const list = await fetchKeep(`${BASE}${listUrl}`, jar, {
    method: 'POST',
    body,
    headers: {
      __RequestVerificationToken: token,
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: first.url,
    },
  });
  if (!list.res.ok) throw new Error(`Green Airways said ${list.res.status} (flight list)`);
  const html = await list.res.text();
  if (html.includes(ANTIFRAUD)) throw new BlockedError('Green Airways asked for a human check');

  const legs = [{ from: p.from, to: p.to, date: p.depart }];
  if (p.return) legs.push({ from: p.to, to: p.from, date: p.return });
  return {
    trips: parseResults(html, legs),
    checkedAt: new Date().toISOString(),
    bookingUrl: bookingUrl(p, cfg),
  };
}
