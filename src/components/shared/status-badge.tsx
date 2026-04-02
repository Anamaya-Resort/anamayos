import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BookingStatus } from '@/types';

const statusVariants: Record<BookingStatus, string> = {
  inquiry: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  quote_sent: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  deposit_paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  paid_in_full: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  checked_in: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  checked_out: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  no_show: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
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
