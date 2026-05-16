'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Folder, FolderPlus, Loader2, ChevronRight } from 'lucide-react';

type DriveFolder = { id: string; name: string };
type Crumb = { id: string; name: string };
const ROOT: Crumb = { id: 'root', name: 'My Drive' };

type Props = { connectionId: string; accountEmail: string };

export function AddFolderButton({ connectionId, accountEmail }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('link');

  // Paste-link state
  const [link, setLink] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);

  // Browser state
  const [path, setPath] = useState<Crumb[]>([ROOT]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const cacheRef = useRef<Map<string, DriveFolder[]>>(new Map());

  const [error, setError] = useState<string | null>(null);
  const current = path[path.length - 1];

  const loadFolder = useCallback(
    async (parentId: string) => {
      const cached = cacheRef.current.get(parentId);
      if (cached) {
        setFolders(cached);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/video/drive/folders?connectionId=${connectionId}&parentId=${parentId}`,
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'failed to list folders');
        cacheRef.current.set(parentId, json.folders ?? []);
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
    setError(null);
    setLink('');
    setTab('link');
    setPath([ROOT]);
    void loadFolder(ROOT.id);
  }, [loadFolder]);

  const enter = useCallback(
    (f: DriveFolder) => {
      setPath((p) => [...p, f]);
      void loadFolder(f.id);
    },
    [loadFolder],
  );

  const goTo = useCallback(
    (i: number) => {
      const next = path.slice(0, i + 1);
      setPath(next);
      void loadFolder(next[next.length - 1].id);
    },
    [path, loadFolder],
  );

  const finish = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  const addFromLink = useCallback(async () => {
    setLinkBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/video/sources/from-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, link }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'failed to add folder');
      finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLinkBusy(false);
    }
  }, [connectionId, link, finish]);

  const addCurrent = useCallback(async () => {
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
      finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [connectionId, current, finish]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={start}>
        <FolderPlus className="mr-2 h-4 w-4" />
        Add folder from {accountEmail}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add a Drive folder</DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="link">Paste a link</TabsTrigger>
              <TabsTrigger value="browse">Browse</TabsTrigger>
            </TabsList>

            <TabsContent value="link" className="space-y-3 pt-3">
              <p className="text-sm text-muted-foreground">
                In Google Drive, open the folder and copy the address-bar URL,
                or use its share link. Paste it here.
              </p>
              <Input
                placeholder="https://drive.google.com/drive/folders/…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
              <Button onClick={addFromLink} disabled={linkBusy || !link.trim()}>
                {linkBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add this folder
              </Button>
            </TabsContent>

            <TabsContent value="browse" className="space-y-3 pt-3">
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
                      onClick={() => goTo(i)}
                      disabled={i === path.length - 1}
                    >
                      {c.name}
                    </button>
                  </span>
                ))}
              </div>

              <div className="h-72 overflow-y-auto rounded-lg border">
                {loading ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : folders.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                    No subfolders here. Use “Select this folder” to choose it.
                  </div>
                ) : (
                  <ul className="divide-y">
                    {folders.map((f) => (
                      <li key={f.id}>
                        <button
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted"
                          onClick={() => enter(f)}
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

              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={addCurrent} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Select this folder
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
