'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Trash2, Image as ImageIcon } from 'lucide-react';

interface Graphic {
  id: string;
  slot: string;
  url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
}

const GRAPHIC_GROUPS = [
  { title: 'Icons', slots: ['icon1', 'icon2', 'icon3', 'icon4'] },
  { title: 'Horizontal Frames', slots: ['horiz_frame1', 'horiz_frame2', 'horiz_frame3', 'horiz_frame4'] },
  { title: 'Vertical Graphics', slots: ['vert_graphic1', 'vert_graphic2', 'vert_graphic3', 'vert_graphic4'] },
];

export function OrgGraphicsPanel({ orgId }: { orgId: string }) {
  const [graphics, setGraphics] = useState<Graphic[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  const loadGraphics = async () => {
    const res = await fetch(`/api/admin/organizations/${orgId}/graphics`);
    if (res.ok) {
      const data = await res.json();
      setGraphics(data.graphics);
    }
    setLoading(false);
  };

  useEffect(() => { if (orgId) loadGraphics(); }, [orgId]);

  const uploadGraphic = async (slot: string, file: File) => {
    setUploading(slot);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('slot', slot);
    const res = await fetch(`/api/admin/organizations/${orgId}/graphics`, { method: 'POST', body: formData });
    if (res.ok) await loadGraphics();
    setUploading(null);
  };

  const deleteGraphic = async (slot: string) => {
    await fetch(`/api/admin/organizations/${orgId}/graphics?slot=${slot}`, { method: 'DELETE' });
    await loadGraphics();
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">App Graphics</h3>
        <p className="text-sm text-muted-foreground">Upload custom graphics for your app. These can be placed in various locations throughout the interface. Accepted: webp, jpg, png, gif, webm, mp4. Max 10MB each.</p>
      </div>

      {GRAPHIC_GROUPS.map(({ title, slots }) => (
        <div key={title}>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">{title}</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {slots.map((slot) => {
              const graphic = graphics.find((g) => g.slot === slot);
              const isVideo = graphic?.mime_type?.startsWith('video/');
              return (
                <GraphicSlotCard key={slot} slot={slot} graphic={graphic}
                  isVideo={isVideo ?? false} uploading={uploading === slot}
                  onUpload={(file) => uploadGraphic(slot, file)}
                  onDelete={() => deleteGraphic(slot)} />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function GraphicSlotCard({ slot, graphic, isVideo, uploading, onUpload, onDelete }: {
  slot: string; graphic: Graphic | undefined; isVideo: boolean;
  uploading: boolean; onUpload: (file: File) => void; onDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const label = slot.replace(/_/g, ' ').replace(/(\d+)$/, ' $1');

  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium capitalize">{label}</p>
          {graphic && (
            <button onClick={onDelete} className="text-destructive hover:text-destructive/80">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-center border-2 border-dashed rounded bg-muted/30 aspect-square overflow-hidden"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) onUpload(file); }}>
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : graphic ? (
            isVideo ? (
              <video src={graphic.url} className="w-full h-full object-contain" autoPlay loop muted playsInline />
            ) : (
              <img src={graphic.url} alt={slot} className="w-full h-full object-contain" />
            )
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
          )}
        </div>

        <input ref={fileRef} type="file" className="hidden"
          accept="image/webp,image/jpeg,image/png,image/gif,video/webm,video/mp4"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); e.target.value = ''; }} />
        <Button variant="outline" size="sm" className="w-full text-xs gap-1 h-7"
          onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload className="h-3 w-3" /> {graphic ? 'Replace' : 'Upload'}
        </Button>
      </CardContent>
    </Card>
  );
}
