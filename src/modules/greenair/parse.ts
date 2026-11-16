import type { DayPrice, Fare, Flight, GreenAirConfig, Trip } from './types';

/**
 * Turns Green Airways' booking-engine HTML into plain data.
 * Plain string reading (no HTML library) on purpose: the markup is regular and
 * this keeps the server dependency-free. If they redesign, the search route
 * reports "page changed" instead of showing wrong flights.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const text = (html: string) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const money = (s: string | undefined) => {
  const n = s ? Number(s.replace(/[^0-9.]/g, '')) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** The JSON value starting at `start` (an opening { or [), by bracket matching. */
function jsonAt(src: string, start: number): unknown {
  const open = src[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return JSON.parse(src.slice(start, i + 1));
  }
  return undefined;
}

/** Airports and routes from their search page, so new routes show up by themselves. */
export function parseConfig(html: string): GreenAirConfig | null {
  try {
    const a = html.indexOf('"Airports":{');
    const r = html.indexOf('"OriginDestinations":[{"Origin"');
    if (a < 0 || r < 0) return null;
    const airports = jsonAt(html, a + '"Airports":'.length) as Record<string, { DataId: number; Code: string; Label: string }>;
    const od = jsonAt(html, r + '"OriginDestinations":'.length) as { Origin: string; Destinations: string[] }[];
    const list = Object.values(airports).map((x) => ({
      code: x.Code,
      name: x.Label.replace(/\s*-\s*[A-Z]{3}$/, '').replace('San Jose Santamaria', 'San José (Juan Santamaría)'),
      dataId: x.DataId,
    }));
    const routes = Object.fromEntries(od.map((o) => [o.Origin, o.Destinations]));
    return list.length && Object.keys(routes).length ? { airports: list, routes } : null;
  } catch {
    return null;
  }
}

function parseFare(li: string): Fare {
  const family = text(li.match(/<h4 class="ffs-type">([\s\S]*?)<\/h4>/)?.[1] ?? '');
  const features = [...li.matchAll(/<li class="ff-item[^"]*"[^>]*>[\s\S]*?<\/span>\s*<span>([\s\S]*?)<\/span>/g)].map((m) => text(m[1]));
  const price = money(li.match(/class="fps-price">[\s\S]*?aria-label="([^"]+)"/)?.[1]);
  const cls = li.match(/<article class="([^"]+)"/)?.[1] ?? '';
  return { family, price, features, available: /\bselectable\b/.test(cls) && price !== null };
}

function parseFlight(card: string): Flight | null {
  const codes = [...card.matchAll(/class="route-time__tlc">\s*<span>([A-Z]{3})<\/span>/g)].map((m) => m[1]);
  const times = [...card.matchAll(/class="tlc-time">\s*<span>(\d\d:\d\d)<\/span>/g)].map((m) => m[1]);
  if (codes.length < 2 || times.length < 2) return null;
  // The visible flight number in the flight-details box, e.g. "GW&nbsp;320".
  const flightNo = text(card.match(/class="airline">[\s\S]*?<strong>([\s\S]*?)<\/strong>/)?.[1] ?? '');
  const fares = card.split(/<li class="ffs-item/).slice(1).map(parseFare).filter((f) => f.family);
  const cheapest = fares.filter((f) => f.available && f.price !== null).map((f) => f.price as number);
  return {
    flightNo,
    from: codes[0],
    to: codes[1],
    depart: times[0],
    arrive: times[1],
    duration: text(card.match(/class="duration__label">[\s\S]*?<\/div>\s*<span[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? ''),
    stops: text(card.match(/class="stops__label">[\s\S]*?<\/div>\s*<span>([\s\S]*?)<\/span>/)?.[1] ?? ''),
    aircraft: text(card.match(/Equipment\s*(?:•|&#8226;)\s*<strong>([\s\S]*?)<\/strong>/)?.[1] ?? '') || null,
    fromPrice: cheapest.length ? Math.min(...cheapest) : money(card.match(/data-cheapest-amount="([^"]+)"/)?.[1]),
    fares,
  };
}

function parseDays(section: string, tripIndex: number): DayPrice[] {
  const out: DayPrice[] = [];
  // One chunk per day card in the 7-day strip.
  for (const day of section.split('day-selection-day-item"').slice(1)) {
    const raw = day.match(/data-loadtripsummaries='([^']*)'/)?.[1];
    if (!raw) continue;
    try {
      const sel = JSON.parse(decode(raw)).UserSelections?.[tripIndex];
      const date = String(sel?.SelectedDate ?? '').slice(0, 10);
      if (!date) continue;
      out.push({ date, fromPrice: money(day.match(/class="dollars font-xl">([\d.,]+)</)?.[1]) });
    } catch { /* skip a day we can't read */ }
  }
  return out;
}

export function parseResults(html: string, legs: { from: string; to: string; date: string }[]): Trip[] {
  // Each trip (outbound, return) sits in its own block marked data-triptype="0", "1".
  const marks = [...html.matchAll(/data-triptype="(\d)"/gi)];
  if (!marks.length && !html.includes('flight-card')) {
    if (/no (flight|availability)/i.test(text(html))) return legs.map((l) => ({ ...l, days: [], flights: [] }));
    throw new Error('Green Airways page changed (flight list)');
  }
  return legs.map((leg, i) => {
    const start = marks.find((m) => Number(m[1]) === i)?.index ?? (i === 0 ? 0 : -1);
    if (start < 0) return { ...leg, days: [], flights: [] };
    const next = marks.find((m) => (m.index ?? 0) > start && Number(m[1]) !== i)?.index ?? html.length;
    const section = html.slice(start, next);
    const flights = section
      .split('class="flight-card"')
      .slice(1)
      .map(parseFlight)
      .filter((f): f is Flight => f !== null && f.from === leg.from && f.to === leg.to);
    return { ...leg, days: parseDays(section, i), flights };
  });
}
