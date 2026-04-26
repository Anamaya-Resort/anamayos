'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X, ChevronUp, ChevronDown } from 'lucide-react';

interface MediaItem {
  id: string;
  url: string;
  purpose: string;
  caption: string | null;
  alt_text: string | null;
  sort_order: number;
}

interface Props { retreatId: string; }

export function MediaPanel({ retreatId }: Props) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const heroRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const loadMedia = useCallback(async () => {
    const res = await fetch(`/api/admin/retreat-media?retreatId=${retreatId}`);
    const data = await res.json();
    setMedia(data.media ?? []);
    setLoading(false);
  }, [retreatId]);

  useEffect(() => { loadMedia(); }, [loadMedia]);

  const uploadImage = async (file: File, purpose: string) => {
    setUploading(purpose);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('retreatId', retreatId);
    formData.append('purpose', purpose);
    await fetch('/api/admin/retreat-media', { method: 'POST', body: formData });
    await loadMedia();
    setUploading(null);
  };

  const deleteMedia = async (id: string) => {
    await fetch(`/api/admin/retreat-media?id=${id}`, { method: 'DELETE' });
    await loadMedia();
  };

  const hero = media.find((m) => m.purpose === 'hero');
  const gallery = media.filter((m) => m.purpose === 'gallery').sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
        {/* Hero Image */}
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Hero Image</label>
          <div className="mt-1">
            {hero ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hero.url} alt="Hero" className="rounded border max-h-40 object-cover" />
                <button onClick={() => deleteMedia(hero.id)}
                  className="absolute -top-2 -right-2 rounded-full bg-destructive text-white p-0.5 hover:bg-destructive/80">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/30 py-8 cursor-pointer hover:bg-muted/50"
                onClick={() => heroRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) uploadImage(f, 'hero'); }}>
                {uploading === 'hero' ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
                  <div className="text-center">
                    <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Click or drag to upload hero image</p>
                  </div>
                )}
              </div>
            )}
            <input ref={heroRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'hero'); e.target.value = ''; }} />
          </div>
        </div>

        {/* Gallery */}
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Gallery</label>
          <div className="mt-1 flex flex-wrap gap-3">
            {gallery.map((m) => (
              <div key={m.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.alt_text ?? 'Gallery'} className="rounded border h-24 w-32 object-cover" />
                <button onClick={() => deleteMedia(m.id)}
                  className="absolute -top-2 -right-2 rounded-full bg-destructive text-white p-0.5 hover:bg-destructive/80">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/30 h-24 w-32 cursor-pointer hover:bg-muted/50"
              onClick={() => galleryRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) uploadImage(f, 'gallery'); }}>
              {uploading === 'gallery' ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (
                <Upload className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
          <input ref={galleryRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'gallery'); e.target.value = ''; }} />
        </div>

        {/* Video URL */}
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Video URL</label>
          <p className="text-[10px] text-muted-foreground">YouTube or Vimeo link</p>
        </div>
    </div>
  );
}
