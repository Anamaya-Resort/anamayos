/**
 * AI vision tagging: claim a batch of proxied image assets, run the
 * deterministic visual stats plus one vision call, store tags /
 * detections / scores. Claim-safe via analysis_status.
 *
 * The model is whatever the org's `vision` role names in
 * video_maker_model_roles - see ai/models.ts. Small batch on purpose;
 * concurrency comes later, and only once rate-limit backoff is proven.
 */
import { db } from '../db.js';
import { computeVisualStats } from '../ai/visual-stats.js';
import { buildSystemPrompt, type VocabRow, type Archetype } from '../ai/vision.js';
import { tagImage, isRetryable } from '../ai/tag.js';
import { recordCost } from '../cost.js';
import { dbLog } from '../joblog.js';
import { log } from '../log.js';
import { MAX_ATTEMPTS } from './proxy.js';

const BATCH = 4;

type AssetRow = {
  id: string;
  org_id: string;
  proxy_path: string;
  analysis_attempts: number;
};

/**
 * On startup, requeue orphaned 'analyzing' rows (the worker died
 * mid-batch) and retry 'error' rows — but only while under the
 * attempt cap.
 *
 * The cap matters. This used to requeue EVERY errored asset on every
 * boot, and Railway reboots on each redeploy. A file that fails after
 * the vision call has already been made (a schema-validation reject,
 * say) was therefore re-billed a Claude call every single deploy,
 * forever, with nothing in the UI showing it.
 */
export async function reclaimOrphanedAnalysis(): Promise<void> {
  const { data } = await db()
    .from('video_assets')
    .update({ analysis_status: 'pending', analysis_error: null })
    .eq('analysis_status', 'analyzing')
    .select('id');
  if (data && data.length > 0) {
    await dbLog('warn', `requeued ${data.length} orphaned analyzing asset(s)`);
  }

  const { data: retried } = await db()
    .from('video_assets')
    .update({ analysis_status: 'pending', analysis_error: null })
    .eq('analysis_status', 'error')
    .lt('analysis_attempts', MAX_ATTEMPTS)
    .select('id');
  if (retried && retried.length > 0) {
    await dbLog('warn', `retrying ${retried.length} errored analysis asset(s)`);
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
    .select('id, org_id, proxy_path, analysis_attempts')
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
      // Model comes from the org's `vision` role, not from this file.
      const tagged = await tagImage({
        orgId: a.org_id,
        systemPrompt: prompt,
        imageBase64: buf.toString('base64'),
      });
      const result = tagged.result;
      const cents = Math.round(tagged.microCents / 10_000);

      await recordCost({
        orgId: a.org_id,
        kind: 'vision',
        refId: a.id,
        modelEndpoint: tagged.modelEndpoint,
        microCents: tagged.microCents,
        inputTokens: tagged.inputTokens,
        outputTokens: tagged.outputTokens,
        cachedTokens: tagged.cachedTokens,
      });

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
          model_endpoint: tagged.modelEndpoint,
          cost_cents: cents,
        },
        { onConflict: 'asset_id' },
      );

      // segment_id IS NULL keeps this to whole-asset tags.
      await sb
        .from('video_asset_tags')
        .delete()
        .eq('asset_id', a.id)
        .eq('source', 'ai')
        .is('segment_id', null);
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
          analysis_model: tagged.modelEndpoint,
          analysis_cost_cents: cents,
          analysis_status: 'done',
          analyzed_at: new Date().toISOString(),
        })
        .eq('id', a.id);

      await dbLog('info', 'analyze complete', {
        assetId: a.id,
        model: tagged.modelEndpoint,
        tags: result.tags.length,
        detections: result.detections.length,
        microCents: tagged.microCents,
        cached: tagged.cachedTokens > 0,
        ms: tagged.latencyMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ assetId: a.id, err: msg }, 'analyze failed');

      // A 429 or a 5xx says the provider is busy, not that the image
      // is bad. Returning it to 'pending' without charging it an
      // attempt is what makes it safe to raise concurrency later;
      // otherwise a burst of rate limits would permanently fail
      // perfectly good photos three attempts at a time.
      if (isRetryable(err)) {
        await dbLog('warn', 'analyze rate-limited, requeued', {
          assetId: a.id,
          error: msg,
        });
        await sb
          .from('video_assets')
          .update({ analysis_status: 'pending', analysis_error: msg })
          .eq('id', a.id);
        // Give the provider room before the next tick hits it again.
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      await dbLog('error', 'analyze failed', { assetId: a.id, error: msg });
      await sb
        .from('video_assets')
        .update({
          analysis_status: 'error',
          analysis_error: msg,
          analysis_attempts: (a.analysis_attempts ?? 0) + 1,
        })
        .eq('id', a.id);
    }
  }
}
