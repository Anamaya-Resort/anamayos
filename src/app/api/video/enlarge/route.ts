import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getAccessTokenForConnection } from '@/modules/video/drive/token-refresh';

export const maxDuration = 120;

/**
 * Enlarge an image and hand it back as a download.
 *
 * Two things worth being straight about. It always starts from the
 * ORIGINAL in Drive, never the 1280px proxy the grid shows - for most
 * of this library the original is already several times larger, so
 * that alone is the bulk of the win and costs nothing. And the
 * resampling is Lanczos, which is arithmetic, not a model: it makes
 * more pixels without altering the picture. It cannot invent detail
 * that was never captured, and nothing here pretends otherwise.
 */
const MAX_EDGE = 8000;

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canManageVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const sp = new URL(req.url).searchParams;
  const assetId = sp.get('id');
  const factor = Math.min(4, Math.max(1, Number(sp.get('factor') ?? 1)));
  if (!assetId) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: asset } = await supabase
    .from('video_assets')
    .select('id, file_name, drive_file_id, source_id, width, height, mime_type')
    .eq('id', assetId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!asset) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!asset.mime_type.startsWith('image/')) {
    return NextResponse.json({ error: 'not an image' }, { status: 400 });
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
    const original = Buffer.from(await dl.arrayBuffer());

    let out: Buffer<ArrayBufferLike> = original;
    let contentType = asset.mime_type;
    let name = asset.file_name;

    if (factor > 1) {
      const meta = await sharp(original).metadata();
      const w = meta.width ?? asset.width ?? 0;
      const h = meta.height ?? asset.height ?? 0;
      if (!w || !h) throw new Error('could not read the image dimensions');
      const scale = Math.min(factor, MAX_EDGE / Math.max(w, h));
      if (scale <= 1) {
        return NextResponse.json(
          { error: `Already ${w}×${h}; enlarging would pass the ${MAX_EDGE}px limit.` },
          { status: 400 },
        );
      }
      out = await sharp(original)
        .rotate()
        .resize(Math.round(w * scale), Math.round(h * scale), {
          kernel: 'lanczos3',
          fit: 'fill',
        })
        .webp({ quality: 92 })
        .toBuffer();
      contentType = 'image/webp';
      name = `${asset.file_name.replace(/\.[^.]+$/, '')}@${factor}x.webp`;
    }

    return new NextResponse(new Uint8Array(out), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${name.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
