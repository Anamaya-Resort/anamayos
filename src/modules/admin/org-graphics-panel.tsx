'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Trash2, Image as ImageIcon, Plus, X } from 'lucide-react';

interface Graphic {
  id: string;
  slot: string;
  url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
}

const GROUP_PREFIXES = [
  { prefix: 'icon', title: 'Icons' },
  { prefix: 'horiz_frame', title: 'Horizontal Frames' },
  { prefix: 'vert_graphic', title: 'Vertical Graphics' },
];

export function OrgGraphicsPanel({ orgId }: { orgId: string }) {
  const [graphics, setGraphics] = useState<Graphic[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Graphic | null>(null);

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

  // Group graphics by prefix
  const getGroupSlots = (prefix: string): string[] => {
    const existing = graphics
      .filter((g) => g.slot.startsWith(prefix))
      .map((g) => g.slot)
      .sort();
    // Always show at least one empty slot
    if (existing.length === 0) return [`${prefix}1`];
    return existing;
  };

  const getNextSlot = (prefix: string): string => {
    const existing = graphics.filter((g) => g.slot.startsWith(prefix));
    const maxNum = existing.reduce((max, g) => {
      const num = parseInt(g.slot.replace(prefix, ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    return `${prefix}${maxNum + 1}`;
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">App Graphics</h3>
        <p className="text-sm text-muted-foreground">Upload custom graphics for your app. Accepted: webp, jpg, png, gif, webm, mp4. Max 10MB each.</p>
      </div>

      {GROUP_PREFIXES.map(({ prefix, title }) => {
        const slots = getGroupSlots(prefix);
        return (
          <div key={prefix}>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">{title}</h4>
            <div className="flex flex-wrap gap-3 items-center">
              {slots.map((slot) => {
                const graphic = graphics.find((g) => g.slot === slot);
                const isVideo = graphic?.mime_type?.startsWith('video/');
                return (
                  <GraphicSlotCard key={slot} slot={slot} graphic={graphic}
                    isVideo={isVideo ?? false} uploading={uploading === slot}
                    onUpload={(file) => uploadGraphic(slot, file)}
                    onDelete={() => deleteGraphic(slot)}
                    onClickImage={() => graphic && setLightbox(graphic)} />
                );
              })}
              {/* + Add button — small, vertically centered with adjacent card */}
              <div className="flex items-center self-center">
                <button
                  onClick={() => {
                    const nextSlot = getNextSlot(prefix);
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/webp,image/jpeg,image/png,image/gif,video/webm,video/mp4';
                    input.onchange = () => {
                      const file = input.files?.[0];
                      if (file) uploadGraphic(nextSlot, file);
                    };
                    input.click();
                  }}
                  className="flex items-center justify-center rounded border border-dashed bg-muted/20 hover:bg-muted/40 transition-colors w-8 h-8 cursor-pointer"
                  title="Add another graphic">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Lightbox modal */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer"
          onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightbox(null)}>
            <X className="h-8 w-8" />
          </button>
          {lightbox.mime_type?.startsWith('video/') ? (
            <video src={lightbox.url} className="max-w-[90vw] max-h-[90vh] object-contain" autoPlay loop muted playsInline
              onClick={(e) => { e.stopPropagation(); setLightbox(null); }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightbox.url} alt={lightbox.file_name} className="max-w-[90vw] max-h-[90vh] object-contain"
              onClick={(e) => { e.stopPropagation(); setLightbox(null); }} />
          )}
        </div>
      )}
    </div>
  );
}

function GraphicSlotCard({ slot, graphic, isVideo, uploading, onUpload, onDelete, onClickImage }: {
  slot: string; graphic: Graphic | undefined; isVideo: boolean;
  uploading: boolean; onUpload: (file: File) => void; onDelete: () => void;
  onClickImage: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const label = slot.replace(/_/g, ' ').replace(/(\d+)$/, ' $1');

  return (
    <Card className="w-[300px]">
      <CardContent className="py-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium capitalize text-muted-foreground truncate">{label}</p>
          {graphic && (
            <button onClick={onDelete} className="text-destructive hover:text-destructive/80 shrink-0">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-center border-2 border-dashed rounded bg-muted/30 aspect-square overflow-hidden cursor-pointer"
          onClick={() => graphic ? onClickImage() : fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) onUpload(file); }}>
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : graphic ? (
            isVideo ? (
              <video src={graphic.url} className="w-full h-full object-contain" autoPlay loop muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={graphic.url} alt={slot} className="w-full h-full object-contain" />
            )
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
          )}
        </div>

        {/* File name */}
        {graphic && (
          <p className="text-[9px] text-muted-foreground truncate" title={graphic.file_name}>{graphic.file_name}</p>
        )}

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
