/**
 * Making a new image out of an existing one.
 *
 * Crop, straighten, enlarge and the AI tools all do the same three
 * things around their one difference: find the best source pixels,
 * then write the result as a NEW asset rather than over the old one.
 *
 * Non-destructive on purpose. This system does not hold the
 * full-size original of anything scanned - only a 1280px preview and
 * a thumbnail - so editing in place would destroy the only copy here
 * and leave Drive as the sole source of truth.
 */
import sharp from 'sharp';
import { createServiceClient } from '@/lib/supabase/server';
import { getAccessTokenForConnection } from '@/modules/video/drive/token-refresh';

const BUCKET = 'video-proxies';

export type ParentAsset = {
  id: string;
  org_id: string;
  source_id: string;
  drive_file_id: string;
  drive_path: string | null;
  file_name: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  captured_at: string | null;
  provider: string | null;
  proxy_path: string | null;
  original_path: string | null;
  color_temp: string | null;
  brightness: number | null;
  dominant_colors: unknown;
  aesthetic_score: number | null;
  detections: unknown;
  archetype_fit: unknown;
};

export const PARENT_FIELDS =
  'id, org_id, source_id, drive_file_id, drive_path, file_name, mime_type, width, height, ' +
  'captured_at, provider, proxy_path, original_path, color_temp, brightness, ' +
  'dominant_colors, aesthetic_score, detections, archetype_fit';

/**
 * The best pixels available for an asset.
 *
 * Drive can hand back the untouched original, which is several times
 * the stored preview, so it is tried first. Everything else - Dropbox
 * especially, which needs a credential this app does not hold, and
 * images we generated ourselves - falls back to what is in storage.
 *
 * The fallback is why this exists as a function. The enlarge route
 * only ever spoke to Drive, so every one of the 2,478 Dropbox images
 * failed with a confusing Drive error instead of quietly using the
 * preview.
 */
export async function fetchSourceBytes(
  orgId: string,
  a: ParentAsset,
): Promise<{ bytes: Buffer; from: 'drive' | 'stored' }> {
  const supabase = createServiceClient();

  if (a.provider === 'google_drive' && !a.drive_file_id.includes(':')) {
    try {
      const { data: src } = await supabase
        .from('video_drive_sources')
        .select('connection_id')
        .eq('id', a.source_id)
        .single();
      if (src) {
        const token = await getAccessTokenForConnection(orgId, src.connection_id);
        const dl = await fetch(
          `https://www.googleapis.com/drive/v3/files/${a.drive_file_id}?alt=media&supportsAllDrives=true`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (dl.ok) {
          return { bytes: Buffer.from(await dl.arrayBuffer()), from: 'drive' };
        }
      }
    } catch {
      // fall through to what we hold - a Drive hiccup should degrade
      // to a smaller source, not fail the edit outright
    }
  }

  const path = a.original_path ?? a.proxy_path;
  if (!path) throw new Error('no stored image to work from');
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`could not read stored image: ${error?.message}`);
  return { bytes: Buffer.from(await data.arrayBuffer()), from: 'stored' };
}

/**
 * Write a processed image as a new asset beside its parent.
 *
 * `syntheticId` stands in for a Drive file id and makes the operation
 * idempotent: the same edit of the same picture is one asset, so a
 * double-click does not litter the library with copies.
 *
 * Analysis is inherited rather than re-run. It is the same
 * photograph, and a second identical vision call would be paid for
 * twice to produce the same words.
 */
export async function createDerivedAsset(opts: {
  orgId: string;
  parent: ParentAsset;
  fileName: string;
  derivedKind: string;
  syntheticId: string;
  full: Buffer;
  width: number;
  height: number;
  pathSuffix?: string | null;
}): Promise<{ id: string; existed: boolean }> {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('video_assets')
    .select('id')
    .eq('source_id', opts.parent.source_id)
    .eq('drive_file_id', opts.syntheticId)
    .maybeSingle();
  if (existing) return { id: existing.id, existed: true };

  const proxy = await sharp(opts.full)
    .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const thumb = await sharp(opts.full)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();

  const p = opts.parent;
  const { data: created, error: insErr } = await supabase
    .from('video_assets')
    .insert({
      org_id: opts.orgId,
      source_id: p.source_id,
      drive_file_id: opts.syntheticId,
      provider: p.provider,
      drive_path:
        p.drive_path && opts.pathSuffix ? `${p.drive_path} ${opts.pathSuffix}` : p.drive_path,
      mime_type: 'image/webp',
      file_name: opts.fileName,
      size_bytes: opts.full.length,
      width: opts.width,
      height: opts.height,
      captured_at: p.captured_at,
      derived_from: p.id,
      derived_kind: opts.derivedKind,
      color_temp: p.color_temp,
      brightness: p.brightness,
      dominant_colors: p.dominant_colors,
      aesthetic_score: p.aesthetic_score,
      detections: p.detections,
      archetype_fit: p.archetype_fit,
      analysis_status: 'done',
      analyzed_at: new Date().toISOString(),
      analysis_model: 'inherited',
      proxy_status: 'done',
      proxied_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (insErr || !created) throw new Error(insErr?.message ?? 'insert failed');

  const dir = `${opts.orgId}/${created.id}`;
  const put = async (path: string, buf: Buffer) => {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: 'image/webp', upsert: true });
    if (error) throw new Error(`upload ${path}: ${error.message}`);
    return path;
  };

  await supabase
    .from('video_assets')
    .update({
      original_path: await put(`${dir}/original.webp`, opts.full),
      proxy_path: await put(`${dir}/proxy.webp`, proxy),
      thumb_path: await put(`${dir}/thumb.webp`, thumb),
    })
    .eq('id', created.id);

  const { data: tags } = await supabase
    .from('video_asset_tags')
    .select('tag, category, source, confidence')
    .eq('asset_id', p.id)
    .is('segment_id', null);
  if (tags && tags.length > 0) {
    await supabase
      .from('video_asset_tags')
      .insert(tags.map((t) => ({ ...t, asset_id: created.id })));
  }

  const { data: desc } = await supabase
    .from('video_asset_descriptions')
    .select('summary, model_endpoint')
    .eq('asset_id', p.id)
    .maybeSingle();
  if (desc) {
    await supabase
      .from('video_asset_descriptions')
      .upsert({ asset_id: created.id, ...desc }, { onConflict: 'asset_id' });
  }

  return { id: created.id, existed: false };
}
