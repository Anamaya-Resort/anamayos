import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getAccessTokenForConnection } from '@/modules/video/drive/token-refresh';

export const maxDuration = 300;

/**
 * Enlarge an image and add the result to the gallery.
 *
 * It always starts from the ORIGINAL in Drive, never the 1280px proxy
 * the grid serves - most originals here are several times larger, so
 * that alone is the bulk of the gain. The resampling is Lanczos, which
 * is arithmetic rather than a model: more pixels, the same picture. It
 * cannot add detail the camera never captured, and nothing here
 * pretends otherwise.
 *
 * The result becomes a real library row so it is searchable and usable
 * like anything else, and it inherits the parent's tags and
 * description rather than being re-tagged - it is the same photograph,
 * so paying a second vision call would buy nothing.
 */
const MAX_EDGE = 8000;
const BUCKET = 'video-proxies';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canManageVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { id?: string; factor?: number };
  const assetId = body.id;
  const factor = Math.min(4, Math.max(2, Math.round(Number(body.factor ?? 2))));
  if (!assetId) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: parent } = await supabase
    .from('video_assets')
    .select(
      'id, file_name, drive_file_id, drive_path, source_id, width, height, mime_type, aesthetic_score, detections, archetype_fit, color_temp, brightness, dominant_colors, captured_at',
    )
    .eq('id', assetId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!parent) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!parent.mime_type.startsWith('image/')) {
    return NextResponse.json({ error: 'Enlarging is for images only.' }, { status: 400 });
  }

  const base = parent.file_name.replace(/\.[^.]+$/, '');
  const newName = `${base} ${factor}x.webp`;

  // Idempotent: the same picture at the same factor is one asset.
  const syntheticDriveId = `upscale:${parent.id}:${factor}x`;
  const { data: existing } = await supabase
    .from('video_assets')
    .select('id')
    .eq('source_id', parent.source_id)
    .eq('drive_file_id', syntheticDriveId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, id: existing.id, name: newName, existed: true });
  }

  const { data: src } = await supabase
    .from('video_drive_sources')
    .select('connection_id')
    .eq('id', parent.source_id)
    .single();
  if (!src) return NextResponse.json({ error: 'source missing' }, { status: 404 });

  try {
    const token = await getAccessTokenForConnection(orgId, src.connection_id);
    const dl = await fetch(
      `https://www.googleapis.com/drive/v3/files/${parent.drive_file_id}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!dl.ok) {
      return NextResponse.json({ error: `Drive download failed: ${dl.status}` }, { status: 502 });
    }
    const original = Buffer.from(await dl.arrayBuffer());

    const meta = await sharp(original).metadata();
    const w = meta.width ?? parent.width ?? 0;
    const h = meta.height ?? parent.height ?? 0;
    if (!w || !h) throw new Error('could not read the image dimensions');

    const scale = Math.min(factor, MAX_EDGE / Math.max(w, h));
    if (scale <= 1) {
      return NextResponse.json(
        { error: `Already ${w}×${h}; enlarging would pass the ${MAX_EDGE}px limit.` },
        { status: 400 },
      );
    }
    const outW = Math.round(w * scale);
    const outH = Math.round(h * scale);

    const full = await sharp(original)
      .rotate()
      .resize(outW, outH, { kernel: 'lanczos3', fit: 'fill' })
      .webp({ quality: 92 })
      .toBuffer();
    const proxy = await sharp(full)
      .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const thumb = await sharp(full)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();

    const { data: created, error: insErr } = await supabase
      .from('video_assets')
      .insert({
        org_id: orgId,
        source_id: parent.source_id,
        drive_file_id: syntheticDriveId,
        drive_path: parent.drive_path ? `${parent.drive_path} (${factor}x)` : null,
        mime_type: 'image/webp',
        file_name: newName,
        size_bytes: full.length,
        width: outW,
        height: outH,
        captured_at: parent.captured_at,
        derived_from: parent.id,
        derived_kind: `upscale_${factor}x`,
        // Same photograph, so it carries the parent's analysis rather
        // than paying for a second identical vision call.
        color_temp: parent.color_temp,
        brightness: parent.brightness,
        dominant_colors: parent.dominant_colors,
        aesthetic_score: parent.aesthetic_score,
        detections: parent.detections,
        archetype_fit: parent.archetype_fit,
        analysis_status: 'done',
        analyzed_at: new Date().toISOString(),
        analysis_model: 'inherited',
        proxy_status: 'done',
        proxied_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (insErr || !created) throw new Error(insErr?.message ?? 'insert failed');

    const dir = `${orgId}/${created.id}`;
    const put = async (path: string, buf: Buffer) => {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, buf, { contentType: 'image/webp', upsert: true });
      if (error) throw new Error(`upload ${path}: ${error.message}`);
      return path;
    };
    const originalPath = await put(`${dir}/original.webp`, full);
    const proxyPath = await put(`${dir}/proxy.webp`, proxy);
    const thumbPath = await put(`${dir}/thumb.webp`, thumb);

    await supabase
      .from('video_assets')
      .update({ original_path: originalPath, proxy_path: proxyPath, thumb_path: thumbPath })
      .eq('id', created.id);

    // Tags and description come from the parent, same reasoning.
    const { data: tags } = await supabase
      .from('video_asset_tags')
      .select('tag, category, source, confidence')
      .eq('asset_id', parent.id)
      .is('segment_id', null);
    if (tags && tags.length > 0) {
      await supabase
        .from('video_asset_tags')
        .insert(tags.map((t) => ({ ...t, asset_id: created.id })));
    }
    const { data: desc } = await supabase
      .from('video_asset_descriptions')
      .select('summary, model_endpoint')
      .eq('asset_id', parent.id)
      .maybeSingle();
    if (desc) {
      await supabase.from('video_asset_descriptions').upsert(
        { asset_id: created.id, summary: desc.summary, model_endpoint: 'inherited', cost_cents: 0 },
        { onConflict: 'asset_id' },
      );
    }

    return NextResponse.json({
      ok: true,
      id: created.id,
      name: newName,
      width: outW,
      height: outH,
      from: `${w}×${h}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
