import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BookingStatus } from '@/types';

/**
 * Maps booking statuses to semantic status categories.
 * Uses CSS variable-based tokens from globals.css, not hardcoded Tailwind colors.
 */
const statusVariants: Record<BookingStatus, string> = {
  inquiry:      'bg-status-info text-status-info',
  quote_sent:   'bg-status-info text-status-info',
  confirmed:    'bg-status-success text-status-success',
  deposit_paid: 'bg-status-success text-status-success',
  paid_in_full: 'bg-status-success text-status-success',
  checked_in:   'bg-status-success text-status-success',
  checked_out:  'bg-[var(--muted)] text-[var(--muted-foreground)]',
  cancelled:    'bg-status-destructive text-status-destructive',
  no_show:      'bg-status-warning text-status-warning',
};

interface StatusBadgeProps {
  status: BookingStatus;
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn('font-medium', statusVariants[status])}>
      {label}
    </Badge>
  );
}
