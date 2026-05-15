'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FolderPlus, Loader2 } from 'lucide-react';

// Google Picker + gapi are loaded at runtime from Google's CDN; no
// official npm types. Narrowly typed `any` escape hatch for the SDK.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

const GAPI_SRC = 'https://apis.google.com/js/api.js';

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function loadPicker(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.picker) return resolve();
    window.gapi.load('picker', {
      callback: () => resolve(),
      onerror: () => reject(new Error('failed to load picker')),
    });
  });
}

type Props = { connectionId: string; accountEmail: string };

export function AddFolderButton({ connectionId, accountEmail }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = useCallback(
    async (data: any) => {
      const picker = window.google.picker;
      if (data.action !== picker.Action.PICKED) return;
      const doc = data.docs?.[0];
      if (!doc) return;

      const driveId: string | null = doc.driveId ?? null;
      const driveKind = driveId ? 'shared_drive_folder' : 'my_drive_folder';

      const res = await fetch('/api/video/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          label: doc.name ?? 'Untitled folder',
          driveFolderId: doc.id,
          driveKind,
          driveId,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? 'failed to add folder');
        return;
      }
      router.refresh();
    },
    [connectionId, router],
  );

  const open = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const tokenRes = await fetch(
        `/api/video/picker-token?connectionId=${connectionId}`,
      );
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenJson.error ?? 'token error');
      const accessToken: string = tokenJson.accessToken;

      await loadScript(GAPI_SRC);
      await loadPicker();

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? '';
      const appId = clientId.split('-')[0];
      const picker = window.google.picker;

      const foldersView = new picker.DocsView(picker.ViewId.FOLDERS)
        .setSelectFolderEnabled(true)
        .setIncludeFolders(true);
      const sharedView = new picker.DocsView(picker.ViewId.FOLDERS)
        .setSelectFolderEnabled(true)
        .setIncludeFolders(true)
        .setEnableDrives(true);

      new picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setAppId(appId)
        .addView(foldersView)
        .addView(sharedView)
        .enableFeature(picker.Feature.SUPPORT_DRIVES)
        .setCallback((data: any) => onPick(data))
        .build()
        .setVisible(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [connectionId, onPick]);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={open} disabled={busy}>
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FolderPlus className="mr-2 h-4 w-4" />
        )}
        Add folder from {accountEmail}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
