'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A titled section that starts closed.
 *
 * For settings that matter rarely but must stay reachable - Drive
 * connections belong under the collection they fill, not beside the
 * pictures somebody looks at every day.
 */
export function CollapsiblePanel({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 bg-card px-4 py-2.5 text-left transition-colors hover:bg-muted/60"
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-90',
          )}
        />
        <span className="text-sm font-medium">{title}</span>
        {subtitle && (
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        )}
      </button>
      {open && <div className="border-t border-border bg-card p-4">{children}</div>}
    </div>
  );
}
