'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface Workshop {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  currency: string;
  sales_commission_pct: number | string;
  anamaya_pct: number | string;
  retreat_leader_pct: number | string;
  payout_person_id: string | null;
  sort_order: number;
  is_active: boolean;
  payout?: { id: string; full_name: string | null } | null;
}

interface Props { retreatId: string; }

export function WorkshopsPanel({ retreatId }: Props) {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/retreat-workshops?retreatId=${retreatId}`);
      if (res.ok) {
        const data = await res.json();
        setWorkshops(data.workshops ?? []);
      }
      setLoading(false);
    })();
  }, [retreatId]);

  if (loading) {
    return (
      <div className="py-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (workshops.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-2">
        No optional workshops on this retreat.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Optional add-on workshops guests can purchase. Edit currently requires Supabase access — admin UI coming.
      </p>
      <div className="space-y-2">
        {workshops.map((w) => {
          const price = w.price != null ? Number(w.price) : null;
          return (
            <div key={w.id} className="rounded border bg-muted/20 px-3 py-2.5 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{w.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Payee: {w.payout?.full_name ?? '— unassigned'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-mono">
                    {price != null ? `${w.currency === 'USD' ? '$' : ''}${price.toFixed(2)}` : '—'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {Number(w.sales_commission_pct ?? 0).toFixed(0)}% sales · {Number(w.anamaya_pct).toFixed(0)}% house · {Number(w.retreat_leader_pct).toFixed(0)}% leader
                  </div>
                </div>
              </div>
              {w.description && (
                <div
                  className="text-xs text-muted-foreground prose prose-xs max-w-none [&_p]:my-1 [&_strong]:text-foreground"
                  dangerouslySetInnerHTML={{ __html: w.description }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
