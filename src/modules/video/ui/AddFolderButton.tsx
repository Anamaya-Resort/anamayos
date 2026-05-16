'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Folder, FolderPlus, Loader2, ChevronRight } from 'lucide-react';

type DriveFolder = { id: string; name: string };
type Crumb = { id: string; name: string };
const ROOT: Crumb = { id: 'root', name: 'My Drive' };

type Props = { connectionId: string; accountEmail: string };

export function AddFolderButton({ connectionId, accountEmail }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<Crumb[]>([ROOT]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = path[path.length - 1];

  const load = useCallback(
    async (parentId: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/video/drive/folders?connectionId=${connectionId}&parentId=${parentId}`,
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'failed to list folders');
        setFolders(json.folders ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setFolders([]);
      } finally {
        setLoading(false);
      }
    },
    [connectionId],
  );

  const start = useCallback(() => {
    setOpen(true);
    setPath([ROOT]);
    void load(ROOT.id);
  }, [load]);

  const openFolder = useCallback(
    (f: DriveFolder) => {
      setPath((p) => [...p, f]);
      void load(f.id);
    },
    [load],
  );

  const goTo = useCallback(
    (i: number) => {
      const next = path.slice(0, i + 1);
      setPath(next);
      void load(next[next.length - 1].id);
    },
    [path, load],
  );

  const choose = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/video/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          label: current.name,
          driveFolderId: current.id,
          driveKind: 'my_drive_folder',
          driveId: null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'failed to add folder');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [connectionId, current, router]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={start}>
        <FolderPlus className="mr-2 h-4 w-4" />
        Add folder from {accountEmail}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Choose a folder</DialogTitle>
          </DialogHeader>

          {/* Location breadcrumb */}
          <div className="flex flex-wrap items-center gap-1 rounded-md bg-muted px-3 py-2 text-sm">
            {path.map((c, i) => (
              <span key={c.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                <button
                  className={
                    i === path.length - 1
                      ? 'font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:underline'
                  }
                  onClick={() => goTo(i)}
                  disabled={i === path.length - 1}
                >
                  {c.name}
                </button>
              </span>
            ))}
          </div>

          {/* Folder list — click a row to open that folder */}
          <div className="h-80 overflow-y-auto rounded-md border">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : folders.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                This folder has no subfolders. Click “Select this folder” to use it.
              </div>
            ) : (
              <ul className="divide-y">
                {folders.map((f) => (
                  <li key={f.id}>
                    <button
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted"
                      onClick={() => openFolder(f)}
                      title={`Open ${f.name}`}
                    >
                      <Folder className="h-5 w-5 shrink-0 text-brand-highlight" />
                      <span className="flex-1 break-words">{f.name}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={choose} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Select this folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
