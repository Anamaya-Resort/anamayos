'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Users, Tag } from 'lucide-react';

export interface RetreatCardData {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  categories?: string[];
  excerpt?: string | null;
  description?: string | null;
  max_capacity?: number | null;
  available_spaces?: number | null;
  images?: unknown;
  teacher?: string | null;
  feature_image_url?: string | null;
}

interface RetreatCardProps {
  retreat: RetreatCardData;
  variant?: 'default' | 'compact' | 'mini';
  statusBorder?: boolean;
  onClick?: () => void;
  actions?: React.ReactNode;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function fmtDateShort(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&hellip;/g, '…').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function getImage(retreat: RetreatCardData): string | null {
  if (retreat.feature_image_url) return retreat.feature_image_url;
  const imgObj = retreat.images as Record<string, { url?: string }> | null;
  return imgObj?.large?.url ?? imgObj?.full?.url ?? imgObj?.medium?.url ?? imgObj?.thumbnail?.url ?? null;
}

function getStatusBorderStyle(retreat: RetreatCardData): React.CSSProperties {
  const now = new Date().toISOString().split('T')[0];
  let color = 'transparent';
  if (retreat.status === 'cancelled') color = 'var(--retreat-past)';
  else if (retreat.status === 'completed') color = 'var(--retreat-past)';
  else if (retreat.status === 'draft') color = 'var(--retreat-development)';
  else if (retreat.status === 'confirmed') {
    if (retreat.start_date && retreat.end_date && retreat.start_date <= now && retreat.end_date >= now) {
      color = 'var(--retreat-active)';
    } else {
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
      const cutoff = oneMonthFromNow.toISOString().split('T')[0];
      if (retreat.start_date && retreat.start_date <= cutoff) {
        color = 'var(--retreat-upcoming-soon)';
      } else {
        color = 'var(--retreat-upcoming-far)';
      }
    }
  }
  return { border: `3px solid ${color}` };
}

function getStatusLabel(retreat: RetreatCardData): { text: string; style: React.CSSProperties } {
  const now = new Date().toISOString().split('T')[0];
  const base: React.CSSProperties = { fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: 4 };
  if (retreat.status === 'cancelled') return { text: 'Cancelled', style: { ...base, backgroundColor: 'color-mix(in srgb, var(--retreat-past) 20%, transparent)', color: 'var(--retreat-past)' } };
  if (retreat.status === 'completed') return { text: 'Past', style: { ...base, backgroundColor: 'color-mix(in srgb, var(--retreat-past) 20%, transparent)', color: 'var(--retreat-past)' } };
  if (retreat.status === 'draft') return { text: 'Under Development', style: { ...base, backgroundColor: 'color-mix(in srgb, var(--retreat-development) 20%, transparent)', color: 'var(--retreat-development)' } };
  if (retreat.status === 'confirmed') {
    if (retreat.start_date && retreat.end_date && retreat.start_date <= now && retreat.end_date >= now) {
      return { text: 'Active', style: { ...base, backgroundColor: 'color-mix(in srgb, var(--retreat-active) 20%, transparent)', color: 'var(--retreat-active)' } };
    }
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    const cutoff = oneMonthFromNow.toISOString().split('T')[0];
    if (retreat.start_date && retreat.start_date <= cutoff) {
      return { text: 'Upcoming', style: { ...base, backgroundColor: 'color-mix(in srgb, var(--retreat-upcoming-soon) 20%, transparent)', color: 'var(--retreat-upcoming-soon)' } };
    }
    return { text: 'Upcoming', style: { ...base, backgroundColor: 'color-mix(in srgb, var(--retreat-upcoming-far) 20%, transparent)', color: 'var(--retreat-upcoming-far)' } };
  }
  return { text: retreat.status, style: { ...base, backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' } };
}

export function RetreatCard({ retreat, variant = 'default', statusBorder = false, onClick, actions }: RetreatCardProps) {
  const img = getImage(retreat);
  const borderStyle = statusBorder ? getStatusBorderStyle(retreat) : {};
  const statusLabel = getStatusLabel(retreat);
  const desc = retreat.description || retreat.excerpt;

  if (variant === 'mini') {
    return (
      <Card className="cursor-pointer hover:shadow-sm transition-shadow" style={borderStyle} onClick={onClick}>
        <CardContent className="py-2.5 px-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{stripHtml(retreat.name)}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {retreat.teacher && <span>with {retreat.teacher}</span>}
              {retreat.start_date && retreat.end_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {fmtDateShort(retreat.start_date)} — {fmtDateShort(retreat.end_date)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span style={statusLabel.style}>
              {statusLabel.text}
            </span>
            {actions}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'compact') {
    return (
      <Card className="cursor-pointer hover:shadow-sm transition-shadow overflow-hidden" style={borderStyle} onClick={onClick}>
        <CardContent className="p-0">
          {img && (
            <div className="bg-muted overflow-hidden relative aspect-[16/9]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={retreat.name} className="absolute inset-0 w-full h-full object-cover" />
            </div>
          )}
          <div className="p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold leading-tight">{stripHtml(retreat.name)}</h3>
              <span className="shrink-0" style={statusLabel.style}>
                {statusLabel.text}
              </span>
            </div>
            {retreat.teacher && <p className="text-xs text-muted-foreground">with {retreat.teacher}</p>}
            {retreat.start_date && retreat.end_date && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3 shrink-0" />
                {fmtDateShort(retreat.start_date)} — {fmtDateShort(retreat.end_date)}
              </p>
            )}
            {actions && <div className="pt-1">{actions}</div>}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default variant — full card with image on top
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden" style={borderStyle} onClick={onClick}>
      <CardContent className="p-0">
        {img && (
          <div className="bg-muted overflow-hidden relative aspect-[16/9]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={retreat.name} className="absolute inset-0 w-full h-full object-cover" />
          </div>
        )}
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold">{stripHtml(retreat.name)}</h3>
            <span className="shrink-0" style={statusLabel.style}>
              {statusLabel.text}
            </span>
          </div>
          {retreat.teacher && <p className="text-xs text-muted-foreground">with {retreat.teacher}</p>}
          {retreat.start_date && retreat.end_date && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {fmtDate(retreat.start_date)} — {fmtDate(retreat.end_date)}
            </p>
          )}
          {(retreat.categories?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1">
              {retreat.categories!.slice(0, 3).map((c, i) => (
                <span key={i} className="text-[10px] bg-muted rounded px-1.5 py-0.5 flex items-center gap-0.5">
                  <Tag className="h-2.5 w-2.5" />{c}
                </span>
              ))}
            </div>
          )}
          {desc && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {stripHtml(desc)}
            </p>
          )}
          <div className="flex items-center justify-between pt-1">
            {retreat.max_capacity && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> {retreat.max_capacity} max
              </span>
            )}
            {retreat.available_spaces != null && (
              <span className={`text-xs font-medium ${(retreat.available_spaces ?? 0) > 0 ? 'text-status-success' : 'text-status-destructive'}`}>
                {(retreat.available_spaces ?? 0) > 0 ? `${retreat.available_spaces} spaces left` : 'Full'}
              </span>
            )}
          </div>
          {actions && <div className="pt-1 flex gap-2">{actions}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
