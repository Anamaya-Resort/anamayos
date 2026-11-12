import Link from 'next/link';
import { cn } from '@/lib/utils';
import { tx, type SocialLabels } from './labels';

export const RANGE_DAYS: Record<string, number> = {
  '7d': 7, '30d': 30, '90d': 90, '12mo': 365,
};
export const RANGE_KEYS = ['7d', '30d', '90d', '12mo'] as const;

/**
 * The window picker.
 *
 * Links, not client state, so every view is a URL you can send to
 * someone and the page stays server rendered.
 */
export function RangePicker({
  basePath, active, platform, labels,
}: {
  /** May already carry a query string; params are merged, not appended. */
  basePath: string;
  active: string;
  platform: string;
  labels: SocialLabels;
}) {
  const href = (range: string) => {
    const [path, query = ''] = basePath.split('?');
    const params = new URLSearchParams(query);
    params.set('platform', platform);
    params.set('range', range);
    return `${path}?${params.toString()}`;
  };

  return (
    <div
      role="group"
      aria-label={tx(labels.range, 'label', 'Date range')}
      className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/50 p-1"
    >
      {RANGE_KEYS.map((key) => {
        const on = key === active;
        return (
          <Link
            key={key}
            href={href(key)}
            scroll={false}
            aria-current={on ? 'true' : undefined}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              on
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tx(labels.range, key, key)}
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
