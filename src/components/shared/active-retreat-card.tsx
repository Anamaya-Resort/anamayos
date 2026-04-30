'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { decodeHtml } from '@/lib/decode-html';

export interface ActiveRetreatData {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  max_capacity: number | null;
  available_spaces: number | null;
  categories: string[];
  images: unknown;
  feature_image_url: string | null;
  leader_name: string | null;
}

interface Props {
  retreat: ActiveRetreatData;
  label?: string; // "CURRENT RETREAT", "CHECKING OUT TODAY", etc.
  labelColor?: string; // CSS color for the label
  onClick?: () => void;
}

export function ActiveRetreatCard({ retreat, label, labelColor, onClick }: Props) {
  const imgObj = retreat.images as Record<string, { url?: string }> | null;
  const imgUrl = retreat.feature_image_url || imgObj?.large?.url || imgObj?.full?.url || imgObj?.medium?.url || null;

  return (
    <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow !p-0 gap-0"
      style={{ border: '3px solid var(--retreat-active)' }}
      onClick={onClick}>
      <div className="flex flex-col sm:flex-row">
        {imgUrl && (
          <div className="sm:w-64 h-48 sm:h-auto overflow-hidden bg-muted shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt={retreat.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              {label && (
                <p className="text-xl font-bold uppercase tracking-wider mb-1"
                  style={{ color: labelColor ?? 'var(--retreat-active)' }}>
                  {label}
                </p>
              )}
              <h3 className="font-semibold text-base">{decodeHtml(retreat.name)}</h3>
              {retreat.leader_name && <p className="text-xs text-muted-foreground">with {retreat.leader_name}</p>}
            </div>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded shrink-0" style={{
              backgroundColor: 'color-mix(in srgb, var(--retreat-active) 20%, transparent)',
              color: 'var(--retreat-active)',
            }}>Active</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {retreat.start_date} — {retreat.end_date}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {retreat.max_capacity != null && <span>Capacity: {retreat.available_spaces ?? '?'}/{retreat.max_capacity}</span>}
            {retreat.categories?.length > 0 && (
              <div className="flex gap-1">
                {retreat.categories.slice(0, 3).map((cat) => (
                  <Badge key={cat} variant="outline" className="text-[10px]">{cat}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
