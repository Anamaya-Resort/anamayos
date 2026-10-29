import Link from 'next/link';
import { PlatformLogo } from './platform-logos';
import type { MarketingPlatform } from './types';
import type { TranslationKeys } from '@/i18n/en';

/**
 * Tabs are links rather than client state, so every view is a real URL
 * that can be bookmarked or shared, and the whole page stays server
 * rendered.
 */
export function PlatformTabs({
  platforms, active, placement, range, dict,
}: {
  platforms: MarketingPlatform[];
  active: string;
  placement: string;
  range: string;
  dict: TranslationKeys;
}) {
  const current = platforms.find((p) => p.key === active) ?? platforms[0];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 border-b border-border">
        {platforms.map((p) => {
          const on = p.key === active;
          return (
            <Link
              key={p.key}
              href={`/dash?platform=${p.key}&placement=all&range=${range}`}
              className={`-mb-px flex items-center gap-2 rounded-t-md border-b-2 px-3 py-2 text-sm transition-colors ${
                on
                  ? 'border-primary bg-card font-semibold text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <PlatformLogo slug={p.logo_slug} />
              {p.name}
            </Link>
          );
        })}
      </div>

      {current && current.placements.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {current.placements.map((pl) => {
            const on = pl === placement;
            const label = (dict.dash.placement as Record<string, string>)[pl] ?? pl;
            return (
              <Link
                key={pl}
                href={`/dash?platform=${current.key}&placement=${pl}&range=${range}`}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const RANGES = ['7d', '30d', '90d', '12mo'] as const;

export function RangePicker({
  active, platform, placement, dict,
}: {
  active: string; platform: string; placement: string; dict: TranslationKeys;
}) {
  return (
    <div className="flex gap-1.5">
      {RANGES.map((r) => {
        const on = r === active;
        return (
          <Link
            key={r}
            href={`/dash?platform=${platform}&placement=${placement}&range=${r}`}
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
              on
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {(dict.dash.range as Record<string, string>)[r] ?? r}
          </Link>
        );
      })}
    </div>
  );
}
