'use client';

import { cn } from '@/lib/utils';

/** Large, thumb-friendly toggle used for lengths, therapists, times and tips. */
export function Chip({ selected, disabled, onClick, children, className }: {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-brand-btn bg-brand-btn text-brand-btn-text'
          : 'border-border bg-card text-foreground hover:border-brand-divider hover:bg-accent',
        disabled && 'cursor-not-allowed opacity-35 hover:border-border hover:bg-card',
        className,
      )}
    >
      {children}
    </button>
  );
}
