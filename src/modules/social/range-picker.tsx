'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarRange } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePicker } from '@/components/shared/date-picker';
import { cn } from '@/lib/utils';
import { tx, type SocialLabels } from './labels';
import { COMPARE_BASES, CUSTOM_RANGE, RANGE_KEYS, type CompareBasis } from './ranges';

function hrefFor(basePath: string, platform: string, params: Record<string, string>) {
  const [path, query = ''] = basePath.split('?');
  const search = new URLSearchParams(query);
  search.set('platform', platform);
  for (const [k, v] of Object.entries(params)) search.set(k, v);
  return `${path}?${search.toString()}`;
}

/**
 * The window picker: four presets plus an arbitrary pair of dates.
 *
 * The presets stay links, not client state, so every view is a URL you
 * can send to someone and the page stays server rendered. The custom
 * pair has to be a form -- two dates are chosen before either is
 * applied -- so it holds its own state and then navigates to the same
 * kind of URL the presets produce. Nothing downstream can tell the
 * difference.
 */
export function RangePicker({
  basePath, active, platform, labels, from, to, locale,
}: {
  /** May already carry a query string; params are merged, not appended. */
  basePath: string;
  active: string;
  platform: string;
  labels: SocialLabels;
  /** The window currently shown, used to seed the custom pickers. */
  from: string;
  to: string;
  locale: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const r = labels.range;

  const apply = () => {
    setOpen(false);
    router.push(hrefFor(basePath, platform, {
      range: CUSTOM_RANGE,
      from: start <= end ? start : end,
      to: start <= end ? end : start,
    }));
  };

  const isCustom = active === CUSTOM_RANGE;

  return (
    <div
      role="group"
      aria-label={tx(r, 'label', 'Date range')}
      className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/50 p-1"
    >
      {RANGE_KEYS.map((key) => {
        const on = key === active;
        return (
          <Link
            key={key}
            href={hrefFor(basePath, platform, { range: key })}
            scroll={false}
            aria-current={on ? 'true' : undefined}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              on
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tx(r, key, key)}
          </Link>
        );
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
            isCustom
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-current={isCustom ? 'true' : undefined}
        >
          <CalendarRange className="h-4 w-4" />
          {isCustom ? `${from} → ${to}` : tx(r, 'custom', 'Custom')}
        </PopoverTrigger>

        <PopoverContent className="w-auto space-y-3 p-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <DatePicker
              value={start}
              onChange={setStart}
              locale={locale}
              label={tx(r, 'from', 'From')}
              placeholder={tx(r, 'pick', 'Pick a date')}
              prevLabel={tx(r, 'prevMonth', 'Previous month')}
              nextLabel={tx(r, 'nextMonth', 'Next month')}
            />
            <DatePicker
              value={end}
              onChange={setEnd}
              min={start}
              locale={locale}
              label={tx(r, 'to', 'To')}
              placeholder={tx(r, 'pick', 'Pick a date')}
              prevLabel={tx(r, 'prevMonth', 'Previous month')}
              nextLabel={tx(r, 'nextMonth', 'Next month')}
            />
          </div>
          <button
            type="button"
            onClick={apply}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {tx(r, 'apply', 'Apply')}
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * How a post is measured: its first seven days, or everything it ever
 * earned.
 *
 * This exists because the fair comparison needs daily readings covering
 * a post's first week, and those only start on the day the connector was
 * switched on. Every post published before that has none, so seven of
 * the panels had nothing to draw and looked broken on an account with
 * four years of history behind it. Lifetime mode makes that back
 * catalogue comparable, at the known cost of favouring whatever has been
 * up longest, and the choice is named on screen rather than implied.
 *
 * A link per option, like the window presets, so the whole view stays a
 * URL someone can send.
 */
export function BasisPicker({
  basePath, active, platform, labels, keep,
}: {
  basePath: string;
  active: CompareBasis;
  platform: string;
  labels: SocialLabels;
  /** Query params to carry across, so switching keeps the window. */
  keep: Record<string, string>;
}) {
  const b = labels.basis;
  return (
    <div
      role="group"
      aria-label={tx(b, 'label', 'Comparison basis')}
      className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/50 p-1"
    >
      {COMPARE_BASES.map((key) => {
        const on = key === active;
        return (
          <Link
            key={key}
            href={hrefFor(basePath, platform, { ...keep, basis: key })}
            scroll={false}
            aria-current={on ? 'true' : undefined}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              on
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tx(b, key, key)}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Says out loud that the figures are seeded test data.
 *
 * Deliberately impossible to miss. The whole dashboard is built and
 * styled against generated numbers until a read token exists, and a
 * realistic-looking chart is exactly the kind of thing that gets
 * screenshotted into a meeting six months later.
 */
export function SampleBanner({ labels }: { labels: SocialLabels }) {
  const b = labels.sampleBanner;
  return (
    <div
      role="status"
      className="flex flex-col gap-1 rounded-lg border-2 border-dashed border-warning bg-warning/10 px-4 py-3"
    >
      <p className="font-heading text-base font-bold text-foreground sm:text-lg">
        {tx(b, 'title')}
      </p>
      <p className="text-sm leading-relaxed text-foreground/80">
        {tx(b, 'body')}
      </p>
    </div>
  );
}
