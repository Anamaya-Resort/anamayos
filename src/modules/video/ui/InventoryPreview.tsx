import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileVideo, FileImage, FileAudio, File } from 'lucide-react';
import type { AssetPreview } from '@/modules/video/library/queries';
import type { TranslationKeys } from '@/i18n/en';

type Props = { assets: AssetPreview[]; total: number; dict: TranslationKeys };

function icon(mime: string) {
  if (mime.startsWith('video/')) return <FileVideo className="h-4 w-4 text-muted-foreground" />;
  if (mime.startsWith('image/')) return <FileImage className="h-4 w-4 text-muted-foreground" />;
  if (mime.startsWith('audio/')) return <FileAudio className="h-4 w-4 text-muted-foreground" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function humanSize(bytes: number | null): string {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function InventoryPreview({ assets, total, dict }: Props) {
  if (total === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{dict.video.inventory.title}</span>
          <Badge className="bg-brand-subtle text-foreground">
            {total.toLocaleString()} {dict.video.inventory.files}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          {dict.video.inventory.subtitle}
        </p>
        <ul className="divide-y rounded-md border">
          {assets.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              {icon(a.mime_type)}
              <span className="min-w-0 flex-1 truncate">{a.file_name}</span>
              <span className="hidden truncate text-xs text-muted-foreground sm:block sm:max-w-[40%]">
                {a.drive_path}
              </span>
              <span className="w-16 text-right text-xs text-muted-foreground">
                {humanSize(a.size_bytes)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
