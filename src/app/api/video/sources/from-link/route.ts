import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { ACCESS_LEVELS } from '@/types';
import { parseDriveFolderId } from '@/modules/video/drive/parse-folder-link';
import { getAccessTokenForConnection } from '@/modules/video/drive/token-refresh';
import { createSource } from '@/modules/video/sources/queries';

const schema = z
  .object({ connectionId: z.string().uuid(), link: z.string().min(1).max(2000) })
  .strict();

const FOLDER_MIME = 'application/vnd.google-apps.folder';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.accessLevel < ACCESS_LEVELS.admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const folderId = parseDriveFolderId(parsed.data.link);
  if (!folderId) {
    return NextResponse.json(
      { error: "Couldn't find a Google Drive folder in that link. Paste the folder's URL or share link." },
      { status: 400 },
    );
  }

  try {
    const accessToken = await getAccessTokenForConnection(orgId, parsed.data.connectionId);
    const metaUrl = new URL(`https://www.googleapis.com/drive/v3/files/${folderId}`);
    metaUrl.searchParams.set('fields', 'id,name,mimeType');
    metaUrl.searchParams.set('supportsAllDrives', 'true');
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) {
      return NextResponse.json(
        { error: `That folder isn't accessible by this Google account (${metaRes.status}).` },
        { status: 400 },
      );
    }
    const meta = (await metaRes.json()) as { name?: string; mimeType?: string };
    if (meta.mimeType !== FOLDER_MIME) {
      return NextResponse.json(
        { error: 'That link points to a file, not a folder.' },
        { status: 400 },
      );
    }

    const id = await createSource({
      orgId,
      connectionId: parsed.data.connectionId,
      label: meta.name ?? 'Drive folder',
      driveKind: 'my_drive_folder',
      driveFolderId: folderId,
      driveId: null,
    });
    return NextResponse.json({ id, name: meta.name });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
