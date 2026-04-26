'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Users, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

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

function getStatusBorderClass(retreat: RetreatCardData): string {
  const now = new Date().toISOString().split('T')[0];
  if (retreat.status === 'cancelled') return 'border-l-4 border-l-red-400';
  if (retreat.status === 'completed') return 'border-l-4 border-l-gray-400';
  if (retreat.status === 'draft') return 'border-l-4 border-l-amber-400';
  if (retreat.status === 'confirmed') {
    if (retreat.start_date && retreat.end_date && retreat.start_date <= now && retreat.end_date >= now) {
      return 'border-l-4 border-l-blue-500'; // active
    }
    return 'border-l-4 border-l-green-500'; // upcoming
  }
  return '';
}

function getStatusLabel(retreat: RetreatCardData): { text: string; className: string } {
  const now = new Date().toISOString().split('T')[0];
  if (retreat.status === 'cancelled') return { text: 'Cancelled', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' };
  if (retreat.status === 'completed') return { text: 'Past', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
  if (retreat.status === 'draft') return { text: 'Under Development', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' };
  if (retreat.status === 'confirmed') {
    if (retreat.start_date && retreat.end_date && retreat.start_date <= now && retreat.end_date >= now) {
      return { text: 'Active', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' };
    }
    return { text: 'Upcoming', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' };
  }
  return { text: retreat.status, className: 'bg-muted text-muted-foreground' };
}

export function RetreatCard({ retreat, variant = 'default', statusBorder = false, onClick, actions }: RetreatCardProps) {
  const img = getImage(retreat);
  const borderClass = statusBorder ? getStatusBorderClass(retreat) : '';
  const statusLabel = getStatusLabel(retreat);
  const desc = retreat.description || retreat.excerpt;

  if (variant === 'mini') {
    return (
      <Card className={cn('cursor-pointer hover:shadow-sm transition-shadow', borderClass)} onClick={onClick}>
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
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', statusLabel.className)}>
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
      <Card className={cn('cursor-pointer hover:shadow-sm transition-shadow overflow-hidden', borderClass)} onClick={onClick}>
        <CardContent className="p-0">
          {img && (
            <div className="bg-muted overflow-hidden" style={{ height: 160 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={retreat.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold leading-tight">{stripHtml(retreat.name)}</h3>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0', statusLabel.className)}>
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
    <Card className={cn('cursor-pointer hover:shadow-md transition-shadow overflow-hidden', borderClass)} onClick={onClick}>
      <CardContent className="p-0">
        {img && (
          <div className="bg-muted overflow-hidden relative" style={{ height: 260 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={retreat.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold">{stripHtml(retreat.name)}</h3>
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0', statusLabel.className)}>
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
