'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LayoutViewer } from '@/modules/room-builder';
import type { LayoutJson, LayoutUnit } from '@/modules/room-builder';

interface RoomLayoutPreviewProps {
  roomId: string;
  beds: Array<{ id: string; label: string; bed_type: string; capacity: number }>;
}

interface LayoutResponse {
  layout: {
    layout_json: LayoutJson;
    unit?: LayoutUnit;
  };
}

export function RoomLayoutPreview({ roomId, beds }: RoomLayoutPreviewProps) {
  const [layout, setLayout] = useState<{ json: LayoutJson; unit: LayoutUnit } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  const viewerBeds = useMemo(
    () => beds.map((b) => ({ id: b.id, label: b.label, bedType: b.bed_type, capacity: b.capacity })),
    [beds],
  );

  const loadLayout = useCallback(async () => {
    const myReq = ++reqIdRef.current;
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/layout`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as LayoutResponse;
      if (myReq !== reqIdRef.current) return; // stale response — ignore
      setLayout({
        json: data.layout?.layout_json ?? { shapes: [], beds: [], labels: [] },
        unit: (data.layout?.unit as LayoutUnit) ?? 'meters',
      });
      setError(null);
    } catch (e) {
      if (myReq !== reqIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load layout');
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  // Refetch when the editor in another tab broadcasts a save
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('room-layout-saved');
    ch.onmessage = (ev) => {
      if (ev.data?.roomId === roomId) loadLayout();
    };
    return () => ch.close();
  }, [roomId, loadLayout]);

  // Refetch when the tab regains focus (covers browsers without BroadcastChannel)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadLayout();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadLayout]);

  const openEditor = () => {
    window.open(`/dashboard/rooms/${roomId}/layout`, '_blank', 'noopener,noreferrer');
  };

  const hasContent =
    layout &&
    ((layout.json.shapes?.length ?? 0) > 0 ||
      (layout.json.beds?.length ?? 0) > 0 ||
      (layout.json.furniture?.length ?? 0) > 0 ||
      (layout.json.walls?.length ?? 0) > 0);

  return (
    <div className="px-4 pb-6">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Room Layout
        </label>
        <Button size="sm" variant="outline" onClick={openEditor} className="h-7 text-[11px]">
          <ExternalLink className="h-3 w-3 mr-1" />
          Edit Room Layout
        </Button>
      </div>

      <div className="rounded-md border border-border bg-muted/20 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
            Loading layout…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-xs text-destructive">
            Failed to load layout: {error}
          </div>
        ) : hasContent && layout ? (
          <LayoutViewer layoutJson={layout.json} unit={layout.unit} beds={viewerBeds} />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-xs text-muted-foreground gap-2">
            <span>No layout designed yet.</span>
            <button onClick={openEditor} className="text-primary hover:underline cursor-pointer">
              Open Room Builder →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
