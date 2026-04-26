'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RetreatData } from '../retreat-editor';

interface Props { retreat: RetreatData; onChange: (partial: Record<string, unknown>) => void; sessionAccessLevel: number; }

export function SettingsPanel({ retreat, onChange, sessionAccessLevel }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px] text-foreground/70">Settings & Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status — admin only */}
        {sessionAccessLevel >= 5 && (
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
            <select value={(retreat.status as string) ?? 'draft'} onChange={(e) => onChange({ status: e.target.value })}
              className="w-full mt-1 rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50">
              <option value="draft">Draft</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Registration Status</label>
            <select value={(retreat.registration_status as string) ?? 'open'} onChange={(e) => onChange({ registration_status: e.target.value })}
              className="w-full mt-1 rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50">
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="waitlist">Waitlist Only</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Location (for off-site retreats)</label>
            <input value={(retreat.location_name as string) ?? ''} onChange={(e) => onChange({ location_name: e.target.value })}
              placeholder="Leave empty for home property" className="w-full mt-1 rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nearest Airport</label>
            <input value={(retreat.nearest_airport as string) ?? ''} onChange={(e) => onChange({ nearest_airport: e.target.value })}
              placeholder="e.g. SJO" className="w-full mt-1 rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">RYT Hours (if applicable)</label>
            <input type="number" value={(retreat.ryt_hours as number) ?? ''} min={0}
              onChange={(e) => onChange({ ryt_hours: e.target.value ? Number(e.target.value) : null })}
              disabled={!retreat.certificate_offered}
              className="w-full mt-1 rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50" />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={retreat.is_private_retreat === true} onChange={(e) => onChange({ is_private_retreat: e.target.checked })} className="rounded border" />
            Private retreat
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={retreat.waitlist_enabled === true} onChange={(e) => onChange({ waitlist_enabled: e.target.checked })} className="rounded border" />
            Enable waitlist
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={retreat.certificate_offered === true} onChange={(e) => onChange({ certificate_offered: e.target.checked })} className="rounded border" />
            Certificate offered
          </label>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Internal Notes</label>
          <textarea value={(retreat.notes as string) ?? ''} onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Internal notes (not visible to guests)" rows={3}
            className="w-full mt-1 rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
        </div>
      </CardContent>
    </Card>
  );
}
