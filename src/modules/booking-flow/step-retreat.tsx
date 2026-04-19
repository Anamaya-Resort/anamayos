'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import type { WizardState } from './booking-wizard';

interface StepRetreatProps {
  retreats: Array<{
    id: string;
    name: string;
    startDate: string | null;
    endDate: string | null;
    teacher: string | null;
    availableSpaces: number | null;
    currency: string;
    images: unknown[];
  }>;
  state: WizardState;
  onUpdate: (partial: Partial<WizardState>) => void;
  onNext: () => void;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

export function StepRetreat({ retreats, state, onUpdate, onNext }: StepRetreatProps) {
  const selectRetreat = (r: StepRetreatProps['retreats'][0]) => {
    onUpdate({
      retreatId: r.id,
      retreatName: r.name,
      checkIn: r.startDate ?? '',
      checkOut: r.endDate ?? '',
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Select a Retreat</h2>
        <p className="text-sm text-muted-foreground">Choose the retreat you&apos;d like to attend, or set custom dates.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {retreats.map((r) => {
          const isSelected = state.retreatId === r.id;
          const img = (r.images as Array<{ url?: string }>)?.[0]?.url;
          return (
            <Card key={r.id}
              className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary' : ''}`}
              onClick={() => selectRetreat(r)}>
              <CardContent className="p-0">
                {img && (
                  <div className="h-32 bg-muted rounded-t-lg overflow-hidden">
                    <img src={img} alt={r.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4 space-y-1">
                  <h3 className="font-semibold">{r.name}</h3>
                  {r.teacher && <p className="text-xs text-muted-foreground">with {r.teacher}</p>}
                  {r.startDate && r.endDate && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {fmtDate(r.startDate)} — {fmtDate(r.endDate)}
                    </p>
                  )}
                  {r.availableSpaces !== null && (
                    <p className={`text-xs ${r.availableSpaces > 0 ? 'text-status-success' : 'text-status-destructive'}`}>
                      {r.availableSpaces > 0 ? `${r.availableSpaces} spaces available` : 'Full'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Custom dates option */}
      <Card className={`cursor-pointer transition-all ${!state.retreatId && state.checkIn ? 'ring-2 ring-primary' : ''}`}
        onClick={() => onUpdate({ retreatId: undefined, retreatName: undefined })}>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm">Custom Dates (no retreat)</h3>
          <div className="flex gap-3 mt-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Check-in</label>
              <input type="date" value={state.checkIn}
                onChange={(e) => onUpdate({ checkIn: e.target.value, retreatId: undefined, retreatName: undefined })}
                className="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Check-out</label>
              <input type="date" value={state.checkOut}
                onChange={(e) => onUpdate({ checkOut: e.target.value, retreatId: undefined, retreatName: undefined })}
                className="w-full border rounded px-2 py-1 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!state.checkIn || !state.checkOut}>
          Next: Guest Details
        </Button>
      </div>
    </div>
  );
}
