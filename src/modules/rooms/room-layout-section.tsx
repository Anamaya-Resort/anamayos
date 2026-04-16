'use client';

import { useEffect, useState } from 'react';
import { LayoutViewer } from '@/modules/room-builder';
import type { LayoutJson, LayoutUnit } from '@/modules/room-builder';

interface RoomLayoutSectionProps {
  roomId: string;
  beds: Array<{ id: string; label: string; bedType: string; capacity: number }>;
}

export function RoomLayoutSection({ roomId, beds }: RoomLayoutSectionProps) {
  const [layout, setLayout] = useState<{ layout_json: LayoutJson; unit: LayoutUnit } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLayout() {
      try {
        const res = await fetch(`/api/admin/rooms/${roomId}/layout`);
        if (res.ok) {
          const data = await res.json();
          const lj = data.layout?.layout_json as LayoutJson;
          if (lj && ((lj.shapes?.length ?? 0) > 0 || (lj.beds?.length ?? 0) > 0)) {
            setLayout({
              layout_json: lj,
              unit: (data.layout?.unit as LayoutUnit) ?? 'meters',
            });
          }
        }
      } catch {
        // No layout available
      }
      setLoading(false);
    }
    fetchLayout();
  }, [roomId]);

  if (loading || !layout) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ fontSize: 12, fontWeight: 600, color: '#78716c', marginBottom: 8 }}>Room Layout</h4>
      <div style={{ border: '1px solid #e7e5e4', borderRadius: 6, overflow: 'hidden' }}>
        <LayoutViewer
          layoutJson={layout.layout_json}
          unit={layout.unit}
          beds={beds}
          selectedBedId={selectedBedId}
          onBedClick={(bedId) => setSelectedBedId(bedId === selectedBedId ? null : bedId)}
        />
      </div>
    </div>
  );
}
