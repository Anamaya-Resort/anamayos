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
import { Folder, FolderPlus, Loader2, ChevronRight, CornerLeftUp } from 'lucide-react';

type DriveFolder = { id: string; name: string };
type Crumb = { id: string; name: string };

type Props = { connectionId: string; accountEmail: string };

const ROOT: Crumb = { id: 'root', name: 'My Drive' };

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

  const openBrowser = useCallback(() => {
    setOpen(true);
    setPath([ROOT]);
    void load(ROOT.id);
  }, [load]);

  const enter = useCallback(
    (f: DriveFolder) => {
      setPath((p) => [...p, { id: f.id, name: f.name }]);
      void load(f.id);
    },
    [load],
  );

  const jumpTo = useCallback(
    (index: number) => {
      const next = path.slice(0, index + 1);
      setPath(next);
      void load(next[next.length - 1].id);
    },
    [path, load],
  );

  const selectCurrent = useCallback(async () => {
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
      <Button variant="outline" size="sm" onClick={openBrowser}>
        <FolderPlus className="mr-2 h-4 w-4" />
        Add folder from {accountEmail}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose the media folder to inventory</DialogTitle>
          </DialogHeader>

          {/* Breadcrumb */}
          <div className="flex flex-wrap items-center gap-1 text-sm">
            {path.map((c, i) => (
              <span key={c.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                <button
                  className={
                    i === path.length - 1
                      ? 'font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:underline'
                  }
                  onClick={() => jumpTo(i)}
                  disabled={i === path.length - 1}
                >
                  {c.name}
                </button>
              </span>
            ))}
          </div>

          {/* Folder list */}
          <div className="max-h-72 overflow-y-auto rounded-md border">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : folders.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                {path.length > 1 ? 'No subfolders here.' : 'No folders found.'}
              </div>
            ) : (
              <ul className="divide-y">
                {folders.map((f) => (
                  <li key={f.id}>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => enter(f)}
                    >
                      <Folder className="h-4 w-4 text-brand-highlight" />
                      <span className="flex-1 break-words">{f.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
            {path.length > 1 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => jumpTo(path.length - 2)}
              >
                <CornerLeftUp className="mr-2 h-4 w-4" /> Up
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={selectCurrent} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Folder className="mr-2 h-4 w-4" />
              )}
              Inventory “{current.name}”
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
