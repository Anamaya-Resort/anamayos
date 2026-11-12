import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * The two sections of the marketing page.
 *
 * Links rather than client state, so each section is a shareable URL and
 * neither one pays for the other's queries. The ads view stays the
 * default: it was here first and it is what people have bookmarked.
 */
export function SectionTabs({
  basePath, active, labels,
}: {
  basePath: string;
  active: 'ads' | 'content';
  labels: { ads: string; content: string };
}) {
  const tabs = [
    { key: 'ads' as const, href: basePath, label: labels.ads },
    { key: 'content' as const, href: `${basePath}?view=content`, label: labels.content },
  ];
  return (
    <nav
      className="flex w-full gap-1 overflow-x-auto border-b border-border"
      aria-label={labels.content}
    >
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-base font-semibold transition-colors sm:text-lg',
              on
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
