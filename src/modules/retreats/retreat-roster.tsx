'use client';

import Link from 'next/link';

export interface RosterRow {
  bookingId: string | null;
  roomName: string;
  bookingType: string | null;
  guestName: string | null;
  notes: string | null;
  email: string | null;
  gender: string | null;
  totalAmount: number;
  depositAmount: number;
  depositDate: string | null;
  balance: number;
  pickupLocation: string | null;
  operator: string | null;
  arrivalTime: string | null;
  dietary: string | null;
}

interface RetreatRosterProps {
  rows: RosterRow[];
  currency: string;
}

function fmtCurrency(amount: number, currency: string): string {
  if (amount === 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  catch { return iso; }
}

export function RetreatRoster({ rows, currency }: RetreatRosterProps) {
  const totalGuests = rows.filter((r) => r.guestName).length;
  const totalAmount = rows.reduce((s, r) => s + r.totalAmount, 0);
  const totalDeposits = rows.reduce((s, r) => s + r.depositAmount, 0);
  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-xs" style={{ minWidth: 1200 }}>
        <thead>
          {/* Column group headers */}
          <tr className="bg-muted/50">
            <th colSpan={2} className="py-1 px-2 text-left font-medium text-muted-foreground border-b" />
            <th colSpan={4} className="py-1 px-2 text-left font-medium text-muted-foreground border-b border-l" />
            <th colSpan={4} className="py-1 px-2 text-center font-medium text-muted-foreground border-b border-l">Payments</th>
            <th colSpan={3} className="py-1 px-2 text-center font-medium text-muted-foreground border-b border-l">Arrival Transportation</th>
            <th colSpan={1} className="py-1 px-2 text-center font-medium text-muted-foreground border-b border-l">Info</th>
          </tr>
          {/* Column headers */}
          <tr className="bg-muted/30 border-b">
            <th className="py-1.5 px-2 text-left font-semibold" style={{ width: 120 }}>Room</th>
            <th className="py-1.5 px-2 text-left font-semibold" style={{ width: 90 }}>Occ</th>
            <th className="py-1.5 px-2 text-left font-semibold border-l" style={{ width: 150 }}>Name</th>
            <th className="py-1.5 px-2 text-left font-semibold" style={{ width: 130 }}>Notes</th>
            <th className="py-1.5 px-2 text-left font-semibold" style={{ width: 170 }}>Email</th>
            <th className="py-1.5 px-2 text-left font-semibold" style={{ width: 55 }}>Gender</th>
            <th className="py-1.5 px-2 text-right font-semibold border-l" style={{ width: 75 }}>Total</th>
            <th className="py-1.5 px-2 text-right font-semibold" style={{ width: 75 }}>Deposit</th>
            <th className="py-1.5 px-2 text-left font-semibold" style={{ width: 80 }}>Dep. Date</th>
            <th className="py-1.5 px-2 text-right font-semibold" style={{ width: 75 }}>Balance</th>
            <th className="py-1.5 px-2 text-left font-semibold border-l" style={{ width: 150 }}>Pickup Location</th>
            <th className="py-1.5 px-2 text-left font-semibold" style={{ width: 90 }}>Operator</th>
            <th className="py-1.5 px-2 text-left font-semibold" style={{ width: 70 }}>Arr. Time</th>
            <th className="py-1.5 px-2 text-left font-semibold border-l" style={{ width: 110 }}>Dietary</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isEmpty = !row.guestName;
            return (
              <tr key={row.bookingId ?? `empty-${row.roomName}-${i}`}
                className={`border-b last:border-0 ${isEmpty ? 'bg-muted/10' : i % 2 === 0 ? '' : 'bg-muted/5'} hover:bg-muted/20`}
                style={{ height: 28 }}>
                <td className="px-2 font-medium truncate">{row.roomName}</td>
                <td className="px-2 text-muted-foreground truncate">{row.bookingType ?? ''}</td>
                <td className="px-2 border-l">
                  {row.bookingId ? (
                    <Link href={`/dashboard/bookings/${row.bookingId}`} className="text-foreground hover:text-primary hover:underline truncate block">
                      {row.guestName ?? ''}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground/40">{row.guestName ?? ''}</span>
                  )}
                </td>
                <td className="px-2 text-muted-foreground truncate">{row.notes ?? ''}</td>
                <td className="px-2 text-muted-foreground truncate">{row.email ?? ''}</td>
                <td className="px-2 text-muted-foreground">{row.gender ?? ''}</td>
                <td className="px-2 text-right font-mono border-l">{isEmpty ? '' : fmtCurrency(row.totalAmount, currency)}</td>
                <td className="px-2 text-right font-mono">{isEmpty ? '' : fmtCurrency(row.depositAmount, currency)}</td>
                <td className="px-2 text-muted-foreground">{isEmpty ? '' : fmtDate(row.depositDate)}</td>
                <td className={`px-2 text-right font-mono ${row.balance > 0 ? 'text-status-destructive font-semibold' : ''}`}>
                  {isEmpty ? '' : (row.balance > 0 ? fmtCurrency(row.balance, currency) : '—')}
                </td>
                <td className="px-2 text-muted-foreground truncate border-l">{row.pickupLocation ?? ''}</td>
                <td className="px-2 text-muted-foreground truncate">{row.operator ?? ''}</td>
                <td className="px-2 text-muted-foreground">{row.arrivalTime ?? ''}</td>
                <td className="px-2 text-muted-foreground truncate border-l">{row.dietary ?? ''}</td>
              </tr>
            );
          })}
        </tbody>
        {/* Summary row */}
        <tfoot>
          <tr className="bg-muted/30 font-semibold border-t-2">
            <td className="py-2 px-2" />
            <td className="py-2 px-2" />
            <td className="py-2 px-2 border-l">Total: {totalGuests} guests</td>
            <td className="py-2 px-2" colSpan={3} />
            <td className="py-2 px-2 text-right font-mono border-l">{fmtCurrency(totalAmount, currency)}</td>
            <td className="py-2 px-2 text-right font-mono">{fmtCurrency(totalDeposits, currency)}</td>
            <td className="py-2 px-2" />
            <td className={`py-2 px-2 text-right font-mono ${totalBalance > 0 ? 'text-status-destructive' : ''}`}>
              {totalBalance > 0 ? fmtCurrency(totalBalance, currency) : '—'}
            </td>
            <td className="py-2 px-2 border-l" colSpan={4} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
