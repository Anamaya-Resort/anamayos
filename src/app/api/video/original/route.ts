import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getAccessTokenForConnection } from '@/modules/video/drive/token-refresh';

export const maxDuration = 120;

/**
 * Stream the untouched original down to the browser.
 *
 * Separate from /enlarge, which now writes into the gallery instead of
 * downloading. Downloading the original is genuinely a download, and
 * for most of this library it is also the simplest way to get more
 * pixels: the stored proxy is 1280px while the original is often
 * several times that.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canManageVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: asset } = await supabase
    .from('video_assets')
    .select('file_name, drive_file_id, source_id, mime_type, original_path')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!asset) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // An enlarged copy has no Drive file; its full-size version is ours.
  if (asset.original_path) {
    const { data, error } = await supabase.storage
      .from('video-proxies')
      .download(asset.original_path);
    if (error || !data) {
      return NextResponse.json({ error: 'stored original unavailable' }, { status: 502 });
    }
    return new NextResponse(await data.arrayBuffer(), {
      headers: {
        'Content-Type': 'image/webp',
        'Content-Disposition': `attachment; filename="${asset.file_name.replace(/"/g, '')}"`,
      },
    });
  }

  const { data: src } = await supabase
    .from('video_drive_sources')
    .select('connection_id')
    .eq('id', asset.source_id)
    .single();
  if (!src) return NextResponse.json({ error: 'source missing' }, { status: 404 });

  try {
    const token = await getAccessTokenForConnection(orgId, src.connection_id);
    const dl = await fetch(
      `https://www.googleapis.com/drive/v3/files/${asset.drive_file_id}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!dl.ok) {
      return NextResponse.json({ error: `Drive download failed: ${dl.status}` }, { status: 502 });
    }
    return new NextResponse(await dl.arrayBuffer(), {
      headers: {
        'Content-Type': asset.mime_type,
        'Content-Disposition': `attachment; filename="${asset.file_name.replace(/"/g, '')}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
