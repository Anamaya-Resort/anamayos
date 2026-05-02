'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader, EmptyState } from '@/components/shared';
import { Search } from 'lucide-react';
import { useAuth } from '@/modules/auth';
import { getDictionary } from '@/i18n';
import { formatDate } from '@/lib/format-date';
import type { Locale } from '@/config/app';

interface Transaction {
  id: string;
  submitted_at: string;
  class: string;
  category: string;
  description: string | null;
  charge_amount: number;
  credit_amount: number;
  grand_total: number;
  currency: string;
  person_name: string | null;
}

const CLASS_FILTERS = ['all', 'item', 'card_payment', 'non_cc_payment', 'discount', 'card_refund'];

export default function TransactionsPage() {
  const { locale } = useAuth();
  const dict = getDictionary((locale ?? 'en') as Locale);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/admin/transactions');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = transactions.filter((t) => {
    if (classFilter !== 'all' && t.class !== classFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (t.description?.toLowerCase().includes(q) ?? false) ||
        (t.person_name?.toLowerCase().includes(q) ?? false) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalCharges = filtered.reduce((sum, t) => sum + (t.charge_amount ?? 0), 0);
  const totalCredits = filtered.reduce((sum, t) => sum + (t.credit_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={dict.transactions.title}
        description={loading ? '...' : `${transactions.length} ${dict.transactions.title.toLowerCase()}`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={dict.transactions.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {CLASS_FILTERS.map((c) => {
            const label = c === 'all'
              ? dict.transactions.allClasses
              : dict.transactions[`class_${c}` as keyof typeof dict.transactions] as string ?? c;
            return (
              <Button
                key={c}
                variant={classFilter === c ? 'default' : 'outline'}
                size="sm"
                onClick={() => setClassFilter(c)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{dict.transactions.totalCharges}</p>
            <p className="text-2xl font-bold font-mono">${totalCharges.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{dict.transactions.totalPayments}</p>
            <p className="text-2xl font-bold font-mono text-status-success">${totalCredits.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{dict.common.loading}</p>
      ) : filtered.length === 0 ? (
        <EmptyState title={dict.transactions.noTransactions} description={dict.transactions.noTransactionsDesc} />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-medium">{dict.transactions.date}</th>
                    <th className="pb-3 pr-4 font-medium">{dict.transactions.description}</th>
                    <th className="pb-3 pr-4 font-medium">{dict.transactions.class}</th>
                    <th className="pb-3 pr-4 font-medium">{dict.transactions.person}</th>
                    <th className="pb-3 font-medium text-right">{dict.transactions.amount}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map((t) => {
                    const classLabel = dict.transactions[`class_${t.class}` as keyof typeof dict.transactions] as string ?? t.class;
                    const amount = t.credit_amount > 0 ? t.credit_amount : -t.charge_amount;
                    const isCredit = t.credit_amount > 0;

                    return (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 pr-4 text-muted-foreground text-xs">
                          {formatDate(t.submitted_at?.split('T')[0] ?? null, (locale ?? 'en') as Locale)}
                        </td>
                        <td className="py-3 pr-4">{t.description ?? t.category}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline" className="text-xs">{classLabel}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {t.person_name ?? '—'}
                        </td>
                        <td className={`py-3 text-right font-mono ${isCredit ? 'text-status-success' : ''}`}>
                          {isCredit ? '+' : ''}${Math.abs(amount).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
