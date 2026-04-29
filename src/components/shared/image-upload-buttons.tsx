'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Upload } from 'lucide-react';

interface Props {
  onFile: (file: File) => void | Promise<void>;
  uploading?: boolean;
  label?: string;
}

/**
 * Standard Upload + Paste from Clipboard buttons.
 * Use this anywhere an image needs to be uploaded.
 * The parent handles the actual upload logic via onFile.
 */
export function ImageUploadButtons({ onFile, uploading = false, label }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClipboard = async () => {
    setError(null);
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find((t) => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          const file = new File([blob], `pasted-${Date.now()}.${imgType.split('/')[1]}`, { type: imgType });
          onFile(file);
          return;
        }
      }
      setError('No image found in clipboard');
    } catch {
      setError('Clipboard access denied — try uploading instead');
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1 text-xs">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {label ?? 'Upload'}
        </Button>
        <Button size="sm" variant="outline" onClick={handleClipboard} disabled={uploading} className="text-xs">
          Paste from Clipboard
        </Button>
        <span className="text-[10px] text-muted-foreground">1200px max, WebP</span>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { setError(null); onFile(f); } e.target.value = ''; }} />
    </div>
  );
}
