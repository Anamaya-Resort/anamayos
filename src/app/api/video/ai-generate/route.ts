import { NextResponse } from 'next/server';
import { z } from 'zod';
import sharp from 'sharp';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { generateImage, MAX_REFERENCES } from '@/modules/video/ai-image';

export const maxDuration = 300;
const BUCKET = 'video-proxies';

const schema = z
  .object({
    prompt: z.string().trim().min(3).max(2000),
    /**
     * Library images whose look the result should follow. This is the
     * point of the feature: a prose description of light never lands
     * the way six of the real photographs do.
     */
    referenceIds: z.array(z.string().uuid()).max(MAX_REFERENCES).default([]),
    aspect: z.enum(['1:1', '4:3', '3:4', '16:9', '9:16']).default('16:9'),
    size: z.enum(['1K', '2K', '4K']).default('2K'),
  })
  .strict();

/**
 * Generate a photograph, in the style of chosen library images.
 *
 * The result is written into the library as a normal asset so it can
 * be searched, put in a gallery and published like any other - but
 * tagged `ai_generated` and named so it is never mistaken for a real
 * photograph of the place. That matters: this is a real hotel, and a
 * generated image passed off as a room someone can book would be a
 * misrepresentation.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canManageVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const { prompt, referenceIds, aspect, size } = parsed.data;

  const supabase = createServiceClient();

  try {
    // References come from the stored previews, not from Drive: 1280px
    // is ample to carry light and palette, and pulling a dozen
    // full-size originals would make this far slower for no gain.
    const references: { mimeType: string; base64: string }[] = [];
    if (referenceIds.length > 0) {
      const { data: refs } = await supabase
        .from('video_assets')
        .select('id, proxy_path')
        .eq('org_id', orgId)
        .in('id', referenceIds);
      for (const r of (refs ?? []) as { id: string; proxy_path: string | null }[]) {
        if (!r.proxy_path) continue;
        const { data } = await supabase.storage.from(BUCKET).download(r.proxy_path);
        if (!data) continue;
        const buf = Buffer.from(await data.arrayBuffer());
        const jpg = await sharp(buf).jpeg({ quality: 88 }).toBuffer();
        references.push({ mimeType: 'image/jpeg', base64: jpg.toString('base64') });
      }
    }

    const out = await generateImage({ orgId, prompt, references, aspect, size });

    const full = await sharp(out.bytes).webp({ quality: 92 }).toBuffer();
    const proxy = await sharp(full)
      .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const thumb = await sharp(full)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    const meta = await sharp(full).metadata();

    // Generated images need a home among the sources. A dedicated
    // one, so they never look like they were scanned from Drive and
    // a rescan can never try to reconcile them against a folder.
    const { data: src } = await supabase
      .from('video_drive_sources')
      .upsert(
        {
          org_id: orgId,
          connection_id: null,
          label: 'AI generated',
          drive_kind: 'generated',
          drive_folder_id: `generated:${orgId}`,
          watch_mode: 'off',
          is_active: false,
          scan_status: 'idle',
        },
        { onConflict: 'org_id,drive_folder_id' },
      )
      .select('id')
      .single();
    if (!src) throw new Error('could not place the generated image');

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const words = prompt.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).slice(0, 6).join('-');
    const fileName = `ai-${words || 'image'}-${stamp}.webp`;

    const { data: created, error: insErr } = await supabase
      .from('video_assets')
      .insert({
        org_id: orgId,
        source_id: src.id,
        drive_file_id: `generated:${stamp}`,
        provider: 'ai',
        drive_path: 'AI generated',
        mime_type: 'image/webp',
        file_name: fileName,
        size_bytes: full.length,
        width: meta.width ?? null,
        height: meta.height ?? null,
        derived_kind: 'ai_generated',
        analysis_status: 'pending',
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
    await supabase
      .from('video_assets')
      .update({
        original_path: await put(`${dir}/original.webp`, full),
        proxy_path: await put(`${dir}/proxy.webp`, proxy),
        thumb_path: await put(`${dir}/thumb.webp`, thumb),
      })
      .eq('id', created.id);

    // Tagged as generated and carrying its own prompt, so nobody has
    // to remember which images were made rather than taken.
    await supabase.from('video_asset_tags').insert([
      { asset_id: created.id, tag: 'ai generated', category: 'media', source: 'ai', confidence: 1 },
      { asset_id: created.id, tag: 'not a real photograph', category: 'media', source: 'ai', confidence: 1 },
    ]);
    await supabase.from('video_asset_descriptions').upsert(
      {
        asset_id: created.id,
        summary: `AI generated from the prompt: ${prompt}`,
        model_endpoint: out.model,
      },
      { onConflict: 'asset_id' },
    );

    return NextResponse.json({
      ok: true,
      id: created.id,
      name: fileName,
      width: meta.width,
      height: meta.height,
      model: out.model,
      referencesUsed: references.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
