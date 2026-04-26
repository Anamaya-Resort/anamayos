'use client';

import { Button } from '@/components/ui/button';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { RetreatData } from '../retreat-editor';

interface ItineraryEvent { time: string; title: string; description: string; }
interface ItineraryDay { day: number; label: string; events: ItineraryEvent[]; }

interface Props { retreat: RetreatData; onChange: (partial: Record<string, unknown>) => void; }

export function ItineraryPanel({ retreat, onChange }: Props) {
  const days = (retreat.itinerary as ItineraryDay[]) ?? [];
  const [openDay, setOpenDay] = useState<number | null>(0);

  const updateDays = (next: ItineraryDay[]) => onChange({ itinerary: next });

  const addDay = () => {
    updateDays([...days, { day: days.length + 1, label: `Day ${days.length + 1}`, events: [] }]);
    setOpenDay(days.length);
  };

  const removeDay = (idx: number) => {
    const next = days.filter((_, i) => i !== idx).map((d, i) => ({ ...d, day: i + 1 }));
    updateDays(next);
    if (openDay === idx) setOpenDay(null);
  };

  const updateDay = (idx: number, field: string, value: string) => {
    updateDays(days.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const addEvent = (dayIdx: number) => {
    updateDays(days.map((d, i) => i === dayIdx ? { ...d, events: [...d.events, { time: '', title: '', description: '' }] } : d));
  };

  const removeEvent = (dayIdx: number, eventIdx: number) => {
    updateDays(days.map((d, i) => i === dayIdx ? { ...d, events: d.events.filter((_, j) => j !== eventIdx) } : d));
  };

  const updateEvent = (dayIdx: number, eventIdx: number, field: string, value: string) => {
    updateDays(days.map((d, i) => i === dayIdx ? {
      ...d, events: d.events.map((e, j) => j === eventIdx ? { ...e, [field]: value } : e)
    } : d));
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">Day-by-day schedule for your retreat</p>
        {days.map((day, di) => (
          <div key={di} className="rounded border bg-muted/10">
            <button onClick={() => setOpenDay(openDay === di ? null : di)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/30">
              <span>{day.label || `Day ${day.day}`}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">{day.events.length} event{day.events.length !== 1 ? 's' : ''}</span>
                {openDay === di ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>
            {openDay === di && (
              <div className="border-t px-3 py-2.5 space-y-2">
                <div className="flex gap-2">
                  <input value={day.label} onChange={(e) => updateDay(di, 'label', e.target.value)}
                    placeholder="Day label (e.g. Arrival Day)" className="flex-1 rounded border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                  <Button size="sm" variant="ghost" onClick={() => removeDay(di)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {day.events.map((event, ei) => (
                  <div key={ei} className="flex gap-2 items-start pl-4">
                    <input type="time" value={event.time} onChange={(e) => updateEvent(di, ei, 'time', e.target.value)}
                      className="w-24 rounded border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                    <input value={event.title} onChange={(e) => updateEvent(di, ei, 'title', e.target.value)}
                      placeholder="Event title" className="flex-1 rounded border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                    <input value={event.description} onChange={(e) => updateEvent(di, ei, 'description', e.target.value)}
                      placeholder="Description (optional)" className="flex-1 rounded border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => removeEvent(di, ei)}>
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => addEvent(di)} className="ml-4 gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add Event
                </Button>
              </div>
            )}
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={addDay} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Add Day
        </Button>
    </div>
  );
}
