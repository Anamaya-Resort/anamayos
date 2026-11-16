'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, ExternalLink, Loader2, Search } from 'lucide-react';
import { DatePicker } from '@/components/shared/date-picker';
import { cn } from '@/lib/utils';
import type { GreenAirConfig, SearchParams, SearchResult } from '../types';
import type { GreenAirLabels } from './labels';
import { AirportPicker, PassengerPicker } from './pickers';
import { TripSection } from './results';

const THEIR_SITE = 'https://www.costaricagreenair.com';

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function toQuery(p: SearchParams) {
  const q = new URLSearchParams({ from: p.from, to: p.to, depart: p.depart, adults: String(p.adults) });
  if (p.return) q.set('return', p.return);
  return q.toString();
}

export function GreenAirSearch({ config, initial, today, labels, locale }: {
  config: GreenAirConfig;
  initial: SearchParams;
  today: string;
  labels: GreenAirLabels;
  locale: string;
}) {
  const [p, setP] = useState<SearchParams>(initial);
  const [roundTrip, setRoundTrip] = useState(!!initial.return);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  // San José and Cóbano first (most guests), then the rest by name.
  const rank = (code: string) => ['SJO', 'ACO'].indexOf(code) + 1 || 9;
  const airports = [...config.airports].sort((a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name));
  const origins = airports.filter((a) => config.routes[a.code]?.length);
  const destinations = airports.filter((a) => config.routes[p.from]?.includes(a.code));
  const canSwap = !!config.routes[p.to]?.includes(p.from);

  const run = useCallback(async (q: SearchParams) => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    window.history.replaceState(null, '', `?${toQuery(q)}${locale !== 'en' ? `&lang=${locale}` : ''}`);
    try {
      const res = await fetch(`/api/public/greenair?${toQuery(q)}`);
      const body = await res.json();
      if (id !== seq.current) return;
      if (!res.ok) {
        setResult(null);
        setError(res.status === 429 ? labels.rateLimited : labels.error);
      } else setResult(body as SearchResult);
    } catch {
      if (id === seq.current) setError(labels.error);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [labels, locale]);

  // Search straight away with the prefilled trip, so guests see flights on arrival.
  useEffect(() => { void run(initial); }, [initial, run]);

  const submit = (next?: Partial<SearchParams>) => {
    const q = { ...p, ...next };
    if (!roundTrip) delete q.return;
    else if (!q.return || q.return < q.depart) q.return = addDays(q.depart, 7);
    setP(q);
    void run(q);
  };

  const setFrom = (from: string) => {
    const to = config.routes[from]?.includes(p.to) ? p.to : (config.routes[from]?.[0] ?? p.to);
    setP({ ...p, from, to });
  };

  const tab = (on: boolean) =>
    cn('rounded-md px-4 py-1.5 text-sm font-medium transition-colors', on ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted');

  const checkedAt = result
    ? new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'America/Costa_Rica' }).format(new Date(result.checkedAt))
    : '';

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="inline-flex rounded-lg border border-border bg-background p-1">
          <button type="button" className={tab(!roundTrip)} onClick={() => setRoundTrip(false)}>{labels.oneWay}</button>
          <button type="button" className={tab(roundTrip)}
            onClick={() => { setRoundTrip(true); if (!p.return) setP({ ...p, return: addDays(p.depart, 7) }); }}>
            {labels.roundTrip}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
          <AirportPicker label={labels.from} value={p.from} options={origins} onChange={setFrom} />
          <button type="button" aria-label={labels.swap} disabled={!canSwap}
            onClick={() => setP({ ...p, from: p.to, to: p.from })}
            className="mx-auto flex size-9 items-center justify-center self-center rounded-full border border-input text-primary hover:bg-muted disabled:opacity-30">
            <ArrowLeftRight className="size-4 rotate-90 md:rotate-0" />
          </button>
          <AirportPicker label={labels.to} value={p.to} options={destinations} onChange={(to) => setP({ ...p, to })} landing />
        </div>

        <div className={cn('grid gap-3 sm:grid-cols-2', roundTrip ? 'lg:grid-cols-[1fr_1fr_1fr_auto]' : 'lg:grid-cols-[1fr_1fr_auto]')}>
          <DatePicker label={labels.depart} value={p.depart} min={today} locale={locale} placeholder={labels.chooseDate}
            prevLabel={labels.prevMonth} nextLabel={labels.nextMonth}
            onChange={(depart) => setP({ ...p, depart, ...(p.return && p.return < depart ? { return: addDays(depart, 7) } : {}) })} />
          {roundTrip && (
            <DatePicker label={labels.return} value={p.return ?? null} min={p.depart} locale={locale} placeholder={labels.chooseDate}
              prevLabel={labels.prevMonth} nextLabel={labels.nextMonth} onChange={(r) => setP({ ...p, return: r })} />
          )}
          <PassengerPicker adults={p.adults} labels={labels} onChange={(adults) => setP({ ...p, adults })} />
          <button type="submit" disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand-btn px-6 py-2.5 text-sm font-semibold text-brand-btn-text transition-colors hover:bg-brand-btn-hover disabled:opacity-60 sm:col-span-2 lg:col-span-1">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {labels.search}
          </button>
        </div>
      </form>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" />
          {labels.searching}
        </div>
      )}

      {!loading && error && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm">{error}</p>
          <a href={THEIR_SITE} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            {labels.openTheirSite}
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      )}

      {!loading && result && (
        <div className="space-y-8">
          {result.trips.map((trip, i) => (
            <TripSection key={`${trip.from}${trip.date}${i}`} trip={trip} index={i} labels={labels} locale={locale}
              bookingUrl={result.bookingUrl}
              onPickDay={(date) => submit(i === 0
                ? { depart: date, ...(p.return && p.return < date ? { return: addDays(date, 7) } : {}) }
                : { return: date })} />
          ))}
          <div className="space-y-1 text-center text-xs text-muted-foreground">
            <p>{labels.bookNote}</p>
            <p>{labels.checked.replace('{time}', checkedAt)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
