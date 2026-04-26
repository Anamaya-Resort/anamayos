'use client';

import type { RetreatData } from '../retreat-editor';

interface Props { retreat: RetreatData; onChange: (partial: Record<string, unknown>) => void; }

export function SeoPanel({ retreat, onChange }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">Admin only — controls website display</p>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Website Slug</label>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-muted-foreground">/retreats/</span>
            <input value={(retreat.website_slug as string) ?? ''} onChange={(e) => onChange({ website_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') || null })}
              placeholder="jungle-yoga-retreat-may-2026" className="flex-1 rounded border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Meta Title</label>
          <input value={(retreat.meta_title as string) ?? ''} onChange={(e) => onChange({ meta_title: e.target.value })}
            placeholder="SEO page title (overrides retreat name)" className="w-full mt-1 rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Meta Description</label>
          <textarea value={(retreat.meta_description as string) ?? ''} onChange={(e) => onChange({ meta_description: e.target.value })}
            placeholder="SEO description (~155 characters)" rows={2}
            className="w-full mt-1 rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
          <p className="text-[10px] text-muted-foreground text-right mt-0.5">{((retreat.meta_description as string) ?? '').length}/155</p>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Structured Data (JSON-LD)</label>
          <textarea value={typeof retreat.structured_data === 'string' ? retreat.structured_data : JSON.stringify(retreat.structured_data ?? {}, null, 2)}
            onChange={(e) => { try { onChange({ structured_data: JSON.parse(e.target.value) }); } catch { /* invalid json, don't save */ } }}
            placeholder='{"@context":"https://schema.org","@type":"Event",...}' rows={6}
            className="w-full mt-1 rounded border bg-background px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={retreat.is_public === true} onChange={(e) => onChange({ is_public: e.target.checked })} className="rounded border" />
            Visible on website
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={retreat.is_featured === true} onChange={(e) => onChange({ is_featured: e.target.checked })} className="rounded border" />
            Featured retreat
          </label>
        </div>
    </div>
  );
}
