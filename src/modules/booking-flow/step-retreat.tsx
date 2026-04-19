'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Users, Tag } from 'lucide-react';
import type { WizardState } from './booking-wizard';
import type { RetreatOption } from './booking-wizard';

interface StepRetreatProps {
  retreats: RetreatOption[];
  state: WizardState;
  onUpdate: (partial: Partial<WizardState>) => void;
  onNext: () => void;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

/** Strip HTML tags and decode entities for plain text display */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&hellip;/g, '…')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function StepRetreat({ retreats, state, onUpdate, onNext }: StepRetreatProps) {
  const selectRetreat = (r: RetreatOption) => {
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
        <p className="text-sm text-muted-foreground">Choose the retreat you&apos;d like to attend.</p>
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
                  <div className="h-36 bg-muted rounded-t-lg overflow-hidden">
                    <img src={img} alt={r.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4 space-y-2 max-h-[280px] overflow-y-auto">
                  <h3 className="font-semibold">{r.name}</h3>
                  {r.teacher && <p className="text-xs text-muted-foreground">with {r.teacher}</p>}

                  {/* Dates */}
                  {r.startDate && r.endDate && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      {fmtDate(r.startDate)} — {fmtDate(r.endDate)}
                    </p>
                  )}

                  {/* Categories */}
                  {r.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {r.categories.slice(0, 3).map((c, i) => (
                        <span key={i} className="text-[10px] bg-muted rounded px-1.5 py-0.5 flex items-center gap-0.5">
                          <Tag className="h-2.5 w-2.5" />{c}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Description — HTML stripped, scrollable */}
                  {(r.excerpt || r.description) && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {stripHtml(r.description || r.excerpt || '')}
                    </p>
                  )}

                  {/* Capacity + availability */}
                  <div className="flex items-center justify-between pt-1">
                    {r.maxCapacity && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" /> {r.maxCapacity} max
                      </span>
                    )}
                    {r.availableSpaces !== null && (
                      <span className={`text-xs font-medium ${r.availableSpaces > 0 ? 'text-status-success' : 'text-status-destructive'}`}>
                        {r.availableSpaces > 0 ? `${r.availableSpaces} spaces left` : 'Full'}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {retreats.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">No upcoming retreats available.</p>
      )}

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!state.retreatId}>
          Next: Guest Details
        </Button>
      </div>
    </div>
  );
}
