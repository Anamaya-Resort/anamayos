'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, DollarSign } from 'lucide-react';

interface RetreatHeaderProps {
  name: string;
  teacher: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  maxCapacity: number | null;
  bookedCount: number;
  totalRevenue: number;
  totalDeposits: number;
  totalBalance: number;
  currency: string;
  categories: string[];
}

function fmtDate(iso: string): string {
  try { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-status-success text-status-success',
  draft: 'bg-status-warning text-status-warning',
  cancelled: 'bg-status-destructive text-status-destructive',
  completed: 'bg-status-info text-status-info',
};

export function RetreatHeader({
  name, teacher, startDate, endDate, status, maxCapacity, bookedCount,
  totalRevenue, totalDeposits, totalBalance, currency, categories,
}: RetreatHeaderProps) {
  const spacesLeft = maxCapacity ? maxCapacity - bookedCount : null;

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        {/* Top row: name + status */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{name}</h1>
            {teacher && <p className="text-sm text-muted-foreground">with {teacher}</p>}
          </div>
          <Badge className={`text-xs shrink-0 ${STATUS_COLORS[status] ?? ''}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-6 text-sm">
          {startDate && endDate && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {fmtDate(startDate)} — {fmtDate(endDate)}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{bookedCount}</span>
            {maxCapacity && <span className="text-muted-foreground">/ {maxCapacity} booked</span>}
            {spacesLeft !== null && spacesLeft > 0 && (
              <span className="text-status-success text-xs ml-1">({spacesLeft} left)</span>
            )}
          </div>
        </div>

        {/* Financial summary */}
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Revenue:</span>
            <span className="font-semibold">{fmtCurrency(totalRevenue, currency)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Deposits:</span>
            <span className="font-semibold ml-1">{fmtCurrency(totalDeposits, currency)}</span>
          </div>
          {totalBalance > 0 && (
            <div>
              <span className="text-status-destructive font-semibold">Balance due: {fmtCurrency(totalBalance, currency)}</span>
            </div>
          )}
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
