/**
 * AI vision tagging: claim a batch of proxied image assets, run the
 * deterministic visual stats + one cached Claude Sonnet 4.6 call,
 * store tags / detections / scores. Claim-safe via analysis_status.
 *
 * Small batch on purpose — Claude calls cost money; ramp gradually
 * so tag quality can be eyeballed on the first images.
 */
import { db } from '../db.js';
import { computeVisualStats } from '../ai/visual-stats.js';
import {
  buildSystemPrompt,
  analyzeImage,
  type VocabRow,
  type Archetype,
} from '../ai/vision.js';
import { dbLog } from '../joblog.js';
import { log } from '../log.js';

const BATCH = 4;

type AssetRow = {
  id: string;
  org_id: string;
  proxy_path: string;
};

// On startup, retry both orphaned 'analyzing' (worker died mid-batch)
// AND 'error' rows. Most analyze errors during bring-up are transient
// (missing key, redeploy) and a fresh boot is the natural retry point;
// if an asset genuinely can't be analyzed it just returns to 'error'.
export async function reclaimOrphanedAnalysis(): Promise<void> {
  const { data } = await db()
    .from('video_assets')
    .update({ analysis_status: 'pending', analysis_error: null })
    .in('analysis_status', ['analyzing', 'error'])
    .select('id');
  if (data && data.length > 0) {
    await dbLog('warn', `requeued ${data.length} analyzing/errored asset(s)`);
  }
}

const promptCache = new Map<string, { prompt: string; archetypes: Archetype[] }>();

export async function orgPrompt(orgId: string) {
  const hit = promptCache.get(orgId);
  if (hit) return hit;
  const sb = db();
  const { data: vocab } = await sb
    .from('video_tag_vocabulary')
    .select('category, tag, localizable, org_id')
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .eq('is_active', true)
    .order('category')
    .order('sort_order');
  const { data: arche } = await sb
    .from('ai_customer_archetypes')
    .select('id, name, description')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('sort_order');
  const archetypes = (arche ?? []) as Archetype[];
  const prompt = buildSystemPrompt(
    (vocab ?? []) as VocabRow[],
    archetypes,
  );
  const built = { prompt, archetypes };
  promptCache.set(orgId, built);
  return built;
}

export async function analyzePendingAssets(): Promise<void> {
  const sb = db();
  const { data: candidates } = await sb
    .from('video_assets')
    .select('id, org_id, proxy_path')
    .eq('analysis_status', 'pending')
    .eq('proxy_status', 'done')
    .eq('is_deleted_on_drive', false)
    .like('mime_type', 'image/%')
    .not('proxy_path', 'is', null)
    .limit(BATCH);

  const rows = (candidates ?? []) as AssetRow[];
  if (rows.length === 0) return;

  const ids = rows.map((r) => r.id);
  const { data: claimed } = await sb
    .from('video_assets')
    .update({ analysis_status: 'analyzing', analysis_error: null })
    .in('id', ids)
    .eq('analysis_status', 'pending')
    .select('id');
  const mine = rows.filter((r) =>
    new Set((claimed ?? []).map((c) => c.id)).has(r.id),
  );
  if (mine.length === 0) return;
  await dbLog('info', `analyze batch: ${mine.length} asset(s)`);

  for (const a of mine) {
    try {
      const dl = await sb.storage.from('video-proxies').download(a.proxy_path);
      if (dl.error || !dl.data) {
        throw new Error(`proxy download failed: ${dl.error?.message ?? 'no data'}`);
      }
      const buf = Buffer.from(await dl.data.arrayBuffer());

      const stats = await computeVisualStats(buf);
      const { prompt, archetypes } = await orgPrompt(a.org_id);
      const { result, cacheRead, cost } = await analyzeImage({
        systemPrompt: prompt,
        imageBase64: buf.toString('base64'),
      });

      // Sonnet 4.6: $3/1M in, $15/1M out, cache reads ~0.1x in.
      const cents = Math.ceil(
        ((cost.input * 3 + cost.output * 15 + cacheRead * 0.3) / 1_000_000) * 100,
      );

      const archByName = new Map(
        archetypes.map((x) => [x.name.toLowerCase(), x.id]),
      );
      const archetypeFit = result.archetype_fit
        .map((f) => ({
          archetype_id: archByName.get(f.archetype.toLowerCase()) ?? null,
          score: f.score,
        }))
        .filter((f) => f.archetype_id);

      await sb.from('video_asset_descriptions').upsert(
        {
          asset_id: a.id,
          summary: result.summary,
          model_endpoint: 'claude-sonnet-4-6',
          cost_cents: cents,
        },
        { onConflict: 'asset_id' },
      );

      await sb.from('video_asset_tags').delete().eq('asset_id', a.id).eq('source', 'ai');
      if (result.tags.length > 0) {
        await sb.from('video_asset_tags').insert(
          result.tags.map((t) => ({
            asset_id: a.id,
            tag: t.tag,
            category: t.category,
            source: 'ai',
            confidence: t.confidence,
          })),
        );
      }

      await sb
        .from('video_assets')
        .update({
          color_temp: stats.colorTemp,
          brightness: stats.brightness,
          dominant_colors: stats.dominantColors,
          aesthetic_score: result.aesthetic_score,
          detections: result.detections,
          archetype_fit: archetypeFit,
          analysis_model: 'claude-sonnet-4-6',
          analysis_cost_cents: cents,
          analysis_status: 'done',
        })
        .eq('id', a.id);

      await dbLog('info', 'analyze complete', {
        assetId: a.id,
        tags: result.tags.length,
        detections: result.detections.length,
        cents,
        cached: cacheRead > 0,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ assetId: a.id, err: msg }, 'analyze failed');
      await dbLog('error', 'analyze failed', { assetId: a.id, error: msg });
      await sb
        .from('video_assets')
        .update({ analysis_status: 'error', analysis_error: msg })
        .eq('id', a.id);
    }
  }
}
