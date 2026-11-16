'use client';

import { useState } from 'react';
import { Check, ChevronDown, ExternalLink, Plane } from 'lucide-react';
import { formatDay } from '@/components/shared/date-picker';
import { cn } from '@/lib/utils';
import type { Fare, Flight, Trip } from '../types';
import type { GreenAirLabels } from './labels';

const usd = (n: number | null) => (n === null ? '' : `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`);

function BookButton({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener"
      className={cn('inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-btn px-3 py-2 text-sm font-medium text-brand-btn-text transition-colors hover:bg-brand-btn-hover', className)}>
      {label}
      <ExternalLink className="size-3.5" />
    </a>
  );
}

function FareCard({ fare, labels, bookingUrl }: { fare: Fare; labels: GreenAirLabels; bookingUrl: string }) {
  return (
    <div className={cn('flex flex-col rounded-lg border border-border bg-background p-3', !fare.available && 'opacity-50')}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-bold tracking-wider text-primary">{fare.family}</h4>
        <span className="text-lg font-bold">{fare.available ? usd(fare.price) : labels.soldOut}</span>
      </div>
      <ul className="mb-3 flex-1 space-y-1.5">
        {fare.features.map((f) => (
          <li key={f} className="flex gap-1.5 text-xs leading-snug text-muted-foreground">
            <Check className="mt-0.5 size-3 shrink-0 text-brand-highlight" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {fare.available && <BookButton href={bookingUrl} label={labels.book} className="w-full" />}
    </div>
  );
}

function FlightCard({ flight, labels, bookingUrl }: { flight: Flight; labels: GreenAirLabels; bookingUrl: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-6 gap-y-3 p-4 text-left transition-colors hover:bg-muted/50">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-xl font-bold">{flight.depart}</div>
            <div className="text-xs font-semibold text-muted-foreground">{flight.from}</div>
          </div>
          <div className="flex w-20 flex-col items-center text-muted-foreground sm:w-28">
            <span className="text-xs">{flight.duration}</span>
            <div className="relative my-1 h-px w-full bg-brand-divider">
              <Plane className="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-card text-primary" />
            </div>
            <span className="text-xs">{flight.stops}</span>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold">{flight.arrive}</div>
            <div className="text-xs font-semibold text-muted-foreground">{flight.to}</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {flight.flightNo && <div>{labels.flightInfo.replace('{no}', flight.flightNo)}</div>}
          {flight.aircraft && <div>{flight.aircraft}</div>}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {flight.fromPrice !== null ? (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{labels.priceFrom}</div>
              <div className="text-xl font-bold text-primary">{usd(flight.fromPrice)}</div>
            </div>
          ) : (
            <span className="text-sm font-medium text-muted-foreground">{labels.soldOut}</span>
          )}
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            <span className="hidden sm:inline">{open ? labels.hideFares : labels.seeFares}</span>
            <ChevronDown className={cn('size-5 transition-transform', open && 'rotate-180')} />
          </span>
        </div>
      </button>
      {open && (
        <div className="grid gap-3 border-t border-border bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {flight.fares.map((f) => <FareCard key={f.family} fare={f} labels={labels} bookingUrl={bookingUrl} />)}
        </div>
      )}
    </div>
  );
}

export function TripSection({ trip, index, labels, locale, bookingUrl, onPickDay }: {
  trip: Trip;
  index: number;
  labels: GreenAirLabels;
  locale: string;
  bookingUrl: string;
  onPickDay: (date: string) => void;
}) {
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-brand-btn px-4 py-3 text-brand-btn-text">
        <span className="text-sm font-semibold tracking-wide uppercase">{index === 0 ? labels.outbound : labels.inbound}</span>
        <span className="text-sm opacity-90">
          {formatDay(trip.date, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        <span className="ml-auto flex items-center gap-2 font-semibold">
          {trip.from}
          <Plane className="size-4 rotate-45" />
          {trip.to}
        </span>
      </header>

      {trip.days.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {trip.days.map((d, i) => {
            const active = d.date === trip.date;
            return (
              <button key={d.date} type="button" onClick={() => !active && onPickDay(d.date)} aria-pressed={active}
                className={cn(
                  'rounded-lg border px-1 py-2 text-center transition-colors',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary',
                  // Phones show 4 days around the chosen one; wider screens all 7.
                  (i < 2 || i > 5) && 'hidden sm:block',
                )}>
                <div className="text-xs capitalize">{formatDay(d.date, locale)}</div>
                <div className={cn('text-sm font-bold', !active && 'text-primary')}>
                  {d.fromPrice !== null ? usd(d.fromPrice) : '·'}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {trip.flights.length ? (
        <div className="space-y-2">
          {trip.flights.map((f) => <FlightCard key={`${f.flightNo}${f.depart}`} flight={f} labels={labels} bookingUrl={bookingUrl} />)}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{labels.noFlights}</p>
      )}
    </section>
  );
}
