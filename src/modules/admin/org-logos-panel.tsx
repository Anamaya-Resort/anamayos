'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Trash2, Image as ImageIcon } from 'lucide-react';

interface Logo {
  id: string;
  slot: string;
  url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
}

const LOGO_SLOTS = [
  { slot: 'portrait', label: 'Portrait Logo', ratio: '2:3', width: 120, height: 180 },
  { slot: 'icon', label: 'Icon Logo', ratio: '1:1', width: 120, height: 120 },
  { slot: 'feature', label: 'Feature Logo', ratio: '3:2', width: 180, height: 120 },
  { slot: 'banner', label: 'Banner Logo', ratio: '4:1', width: 240, height: 60 },
] as const;

export function OrgLogosPanel({ orgId }: { orgId: string }) {
  const [logos, setLogos] = useState<Logo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  const loadLogos = async () => {
    const res = await fetch(`/api/admin/organizations/${orgId}/logos`);
    if (res.ok) {
      const data = await res.json();
      setLogos(data.logos);
    }
    setLoading(false);
  };

  useEffect(() => { if (orgId) loadLogos(); }, [orgId]);

  const uploadLogo = async (slot: string, file: File) => {
    setUploading(slot);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('slot', slot);

    const res = await fetch(`/api/admin/organizations/${orgId}/logos`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) await loadLogos();
    setUploading(null);
  };

  const deleteLogo = async (slot: string) => {
    await fetch(`/api/admin/organizations/${orgId}/logos?slot=${slot}`, { method: 'DELETE' });
    await loadLogos();
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Logos</h3>
        <p className="text-sm text-muted-foreground">Upload logos in different aspect ratios. Accepted: webp, jpg, png, gif, webm, mp4. Max 10MB each.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {LOGO_SLOTS.map(({ slot, label, ratio, width, height }) => {
          const logo = logos.find((l) => l.slot === slot);
          const isVideo = logo?.mime_type?.startsWith('video/');

          return (
            <LogoSlotCard key={slot} slot={slot} label={label} ratio={ratio}
              previewWidth={width} previewHeight={height}
              logo={logo} isVideo={isVideo ?? false}
              uploading={uploading === slot}
              onUpload={(file) => uploadLogo(slot, file)}
              onDelete={() => deleteLogo(slot)} />
          );
        })}
      </div>
    </div>
  );
}

function LogoSlotCard({ slot, label, ratio, previewWidth, previewHeight, logo, isVideo, uploading, onUpload, onDelete }: {
  slot: string; label: string; ratio: string;
  previewWidth: number; previewHeight: number;
  logo: Logo | undefined; isVideo: boolean;
  uploading: boolean;
  onUpload: (file: File) => void; onDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{ratio}</p>
          </div>
          {logo && (
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive h-7 w-7 p-0">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Preview area */}
        <div className="flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/30 overflow-hidden"
          style={{ width: '100%', aspectRatio: `${previewWidth}/${previewHeight}` }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) onUpload(file); }}>
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : logo ? (
            isVideo ? (
              <video src={logo.url} className="w-full h-full object-contain" autoPlay loop muted playsInline />
            ) : (
              <img src={logo.url} alt={label} className="w-full h-full object-contain" />
            )
          ) : (
            <div className="text-center text-muted-foreground">
              <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-30" />
              <p className="text-[10px]">Drop file or click Upload</p>
            </div>
          )}
        </div>

        {/* Upload button */}
        <input ref={fileRef} type="file" className="hidden"
          accept="image/webp,image/jpeg,image/png,image/gif,video/webm,video/mp4"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); e.target.value = ''; }} />
        <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload className="h-3.5 w-3.5" /> {logo ? 'Replace' : 'Upload'}
        </Button>

        {logo && (
          <p className="text-[10px] text-muted-foreground truncate">{logo.file_name} ({logo.file_size ? `${(logo.file_size / 1024).toFixed(0)}KB` : ''})</p>
        )}
      </CardContent>
    </Card>
  );
}
