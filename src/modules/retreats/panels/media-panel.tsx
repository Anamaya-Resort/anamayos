'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { ImageUploadButtons } from '@/components/shared/image-upload-buttons';

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

  const loadMedia = useCallback(async () => {
    const res = await fetch(`/api/admin/retreat-media?retreatId=${retreatId}`);
    const data = await res.json();
    setMedia(data.media ?? []);
    setLoading(false);
  }, [retreatId]);

  useEffect(() => { loadMedia(); }, [loadMedia]);

  const uploadImage = async (file: File, purpose: string) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(purpose);

    // Client-side compress if > 3MB
    let uploadFile = file;
    if (file.size > 3 * 1024 * 1024) {
      try { uploadFile = await compressImage(file, 1400, 0.85); } catch { /* use original */ }
    }

    const formData = new FormData();
    formData.append('file', uploadFile);
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

  if (loading) return <div className="py-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const hero = media.find((m) => m.purpose === 'hero');
  const gallery = media.filter((m) => m.purpose === 'gallery').sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-5">
      {/* Hero Image */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Hero Image</label>
        <p className="text-[10px] text-muted-foreground mb-2">This appears as the main banner on the retreat page and in cards.</p>
        {hero ? (
          <div className="space-y-2">
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hero.url} alt="Hero" className="rounded border max-h-60 object-cover" />
              <button onClick={() => deleteMedia(hero.id)}
                className="absolute -top-2 -right-2 rounded-full bg-destructive text-white p-0.5 hover:bg-destructive/80">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <ImageUploadButtons onFile={(f) => uploadImage(f, 'hero')} uploading={uploading === 'hero'} label="Replace Hero" />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/30 py-10 cursor-pointer hover:bg-muted/50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) uploadImage(f, 'hero'); }}>
              {uploading === 'hero' ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
                <p className="text-xs text-muted-foreground">Drag an image here or use the buttons below</p>
              )}
            </div>
            <ImageUploadButtons onFile={(f) => uploadImage(f, 'hero')} uploading={uploading === 'hero'} label="Upload Hero" />
          </div>
        )}
      </div>

      {/* Gallery */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Gallery</label>
        <p className="text-[10px] text-muted-foreground mb-2">Additional images shown on the retreat detail page.</p>
        <div className="flex flex-wrap gap-3 mb-2">
          {gallery.map((m) => (
            <div key={m.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.alt_text ?? 'Gallery'} className="rounded border h-36 w-48 object-cover" />
              <button onClick={() => deleteMedia(m.id)}
                className="absolute -top-2 -right-2 rounded-full bg-destructive text-white p-0.5 hover:bg-destructive/80">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <ImageUploadButtons onFile={(f) => uploadImage(f, 'gallery')} uploading={uploading === 'gallery'} label="Add Gallery Image" />
      </div>

      {/* Video URL */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Video URL</label>
        <p className="text-[10px] text-muted-foreground">YouTube or Vimeo link</p>
      </div>
    </div>
  );
}

function compressImage(file: File, maxWidth: number, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no canvas')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('no blob')); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
