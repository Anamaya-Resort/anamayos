/**
 * Video segment analyzer — decomposes a proxied video into
 * scene-boundary segments and vision-tags each one, so a long
 * source video becomes a set of individually-pickable, tagged
 * clips with timecodes. Same analysis_status claim model as the
 * image analyzer (reclaimOrphanedAnalysis covers both).
 *
 * Cost-bounded: one video per tick, frame count capped, the org
 * vocabulary system prompt reused (cached) across all frames.
 */
import { createRequire } from 'node:module';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { db } from '../db.js';
import { computeVisualStats } from '../ai/visual-stats.js';
import { analyzeImage, type VisionResult } from '../ai/vision.js';
import { orgPrompt } from './analyze.js';
import {
  ffprobeMeta,
  extractFrame,
  detectSceneTimestamps,
} from '../ffmpeg.js';
import { uploadProxy } from '../storage.js';
import { dbLog } from '../joblog.js';
import { log } from '../log.js';

// sharp-phash is CJS — load via require (same as jobs/proxy.ts).
const require = createRequire(import.meta.url);
const phash = require('sharp-phash') as (input: Buffer) => Promise<string>;

type AssetRow = {
  id: string;
  org_id: string;
  proxy_path: string;
  duration_ms: number | null;
};

const MAX_SEGMENTS = Number(process.env.VIDEO_MAX_SEGMENTS ?? 6);
const SCENE_THRESHOLD = Number(process.env.VIDEO_SCENE_THRESHOLD ?? 0.3);
// Below this mean luma the frame is a black/transition — skip the
// paid vision call. Above this pHash Hamming distance the frame is
// a genuinely new shot; at or below it we reuse the previous tag
// result (free) so static/over-segmented footage costs one call.
const BLACK_THRESH = Number(process.env.VIDEO_BLACK_THRESHOLD ?? 0.05);
const DUP_DIST = Number(process.env.VIDEO_DUP_DISTANCE ?? 6);

/**
 * Segment-start seconds: scene cuts only (no interval padding —
 * that just billed redundant near-identical frames). t=0 always
 * starts the first segment; a single-shot video → one segment →
 * one paid call. Capped by even subsampling.
 */
export function buildBoundaries(durSec: number, scenes: number[]): number[] {
  const set = new Set<number>([0]);
  for (const s of scenes) if (s > 0.2 && s < durSec) set.add(Math.round(s * 2) / 2);

  let pts = [...set].sort((a, b) => a - b);
  // Drop near-duplicates within 0.75s.
  pts = pts.filter((t, i) => i === 0 || t - pts[i - 1] >= 0.75);

  if (pts.length > MAX_SEGMENTS) {
    const stride = (pts.length - 1) / (MAX_SEGMENTS - 1);
    pts = Array.from(
      { length: MAX_SEGMENTS },
      (_, i) => pts[Math.round(i * stride)],
    );
    pts = [...new Set(pts)];
  }
  return pts;
}

/** Hamming distance between two equal-length pHash bit strings. */
function hamming(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

export async function analyzePendingVideos(): Promise<void> {
  const sb = db();
  const { data: candidates } = await sb
    .from('video_assets')
    .select('id, org_id, proxy_path, duration_ms')
    .eq('analysis_status', 'pending')
    .eq('proxy_status', 'done')
    .eq('is_deleted_on_drive', false)
    .like('mime_type', 'video/%')
    .not('proxy_path', 'is', null)
    .limit(1);

  const rows = (candidates ?? []) as AssetRow[];
  if (rows.length === 0) return;

  const a = rows[0];
  const { data: claimed } = await sb
    .from('video_assets')
    .update({ analysis_status: 'analyzing', analysis_error: null })
    .eq('id', a.id)
    .eq('analysis_status', 'pending')
    .select('id');
  if (!claimed || claimed.length === 0) return;

  await dbLog('info', `video analyze: ${a.id}`);
  const dir = await mkdtemp(join(tmpdir(), `seg-${a.id}-`));

  try {
    const dl = await sb.storage.from('video-proxies').download(a.proxy_path);
    if (dl.error || !dl.data) {
      throw new Error(`proxy download failed: ${dl.error?.message ?? 'no data'}`);
    }
    const proxyPath = join(dir, 'proxy.mp4');
    await writeFile(proxyPath, Buffer.from(await dl.data.arrayBuffer()));

    const probe = await ffprobeMeta(proxyPath);
    const durationMs = a.duration_ms || probe.durationMs || 0;
    const durSec = Math.max(durationMs / 1000, 0.5);

    const scenes = await detectSceneTimestamps(proxyPath, SCENE_THRESHOLD);
    const starts = buildBoundaries(durSec, scenes);

    const { prompt, archetypes } = await orgPrompt(a.org_id);
    const archByName = new Map(
      archetypes.map((x) => [x.name.toLowerCase(), x.id]),
    );

    // Fresh run: drop prior segments (cascade clears their tags).
    await sb.from('video_asset_segments').delete().eq('asset_id', a.id);

    let totalCents = 0;
    let bestScore = -1;
    let bestSummary = '';
    let bestColorTemp: string | null = null;
    type ArchFit = { archetype_id: string | null; score: number }[];
    const mapFit = (r: VisionResult): ArchFit =>
      r.archetype_fit
        .map((f) => ({
          archetype_id: archByName.get(f.archetype.toLowerCase()) ?? null,
          score: f.score,
        }))
        .filter((f) => f.archetype_id);
    let prev: { hash: string; result: VisionResult; fit: ArchFit } | null = null;

    for (let i = 0; i < starts.length; i++) {
      const startSec = starts[i];
      const endSec = i + 1 < starts.length ? starts[i + 1] : durSec;
      const startMs = Math.round(startSec * 1000);
      const endMs = Math.max(startMs + 200, Math.round(endSec * 1000));

      const frameFile = join(dir, `f${i}.webp`);
      const grabAt = Math.min(startSec + 0.2, Math.max(startSec, endSec - 0.1));
      await extractFrame(proxyPath, frameFile, grabAt);
      const buf = await readFile(frameFile);

      const stats = await computeVisualStats(buf);
      const framePath = await uploadProxy(
        `${a.org_id}/${a.id}/seg-${i}.webp`,
        buf,
        'image/webp',
      );

      // Decide: black/transition (no AI), near-dup of the last
      // tagged frame (reuse, no AI), or a genuinely new shot (pay).
      let result: VisionResult | null = null;
      let fit: ArchFit = [];
      let model: string | null = null;
      let cents = 0;

      if (stats.brightness >= BLACK_THRESH) {
        const hash = await phash(buf);
        if (prev && hamming(prev.hash, hash) <= DUP_DIST) {
          result = prev.result;
          fit = prev.fit;
          model = 'claude-haiku-4-5'; // reused — billed 0
        } else {
          const ai = await analyzeImage({
            systemPrompt: prompt,
            imageBase64: buf.toString('base64'),
            model: 'claude-haiku-4-5',
          });
          // Haiku 4.5: $1/1M in, $5/1M out, cache reads ~0.1x in.
          cents = Math.ceil(
            ((ai.cost.input * 1 + ai.cost.output * 5 + ai.cacheRead * 0.1) /
              1_000_000) *
              100,
          );
          totalCents += cents;
          result = ai.result;
          fit = mapFit(ai.result);
          model = 'claude-haiku-4-5';
          prev = { hash, result: ai.result, fit };
          if (ai.result.aesthetic_score > bestScore) {
            bestScore = ai.result.aesthetic_score;
            bestSummary = ai.result.summary;
            bestColorTemp = stats.colorTemp;
          }
        }
      }

      const { data: seg } = await sb
        .from('video_asset_segments')
        .insert({
          asset_id: a.id,
          org_id: a.org_id,
          idx: i,
          start_ms: startMs,
          end_ms: endMs,
          frame_path: framePath,
          color_temp: stats.colorTemp,
          brightness: stats.brightness,
          dominant_colors: stats.dominantColors,
          aesthetic_score: result?.aesthetic_score ?? null,
          detections: result?.detections ?? [],
          archetype_fit: fit,
          summary: result?.summary ?? '(low-light / transition)',
          analysis_model: model,
          analysis_cost_cents: cents,
        })
        .select('id')
        .single();

      if (seg && result && result.tags.length > 0) {
        await sb.from('video_asset_tags').insert(
          result.tags.map((t) => ({
            asset_id: a.id,
            segment_id: seg.id,
            tag: t.tag,
            category: t.category,
            source: 'ai',
            confidence: t.confidence,
          })),
        );
      }
    }

    await sb.from('video_asset_descriptions').upsert(
      {
        asset_id: a.id,
        summary: `${starts.length} segment(s) · ${bestSummary}`,
        model_endpoint: 'claude-haiku-4-5',
        cost_cents: totalCents,
      },
      { onConflict: 'asset_id' },
    );

    await sb
      .from('video_assets')
      .update({
        color_temp: bestColorTemp,
        aesthetic_score: bestScore >= 0 ? bestScore : null,
        analysis_model: 'claude-haiku-4-5',
        analysis_cost_cents: totalCents,
        analysis_status: 'done',
      })
      .eq('id', a.id);

    await dbLog('info', 'video analyze complete', {
      assetId: a.id,
      segments: starts.length,
      cents: totalCents,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ assetId: a.id, err: msg }, 'video analyze failed');
    await dbLog('error', 'video analyze failed', { assetId: a.id, error: msg });
    await sb
      .from('video_assets')
      .update({ analysis_status: 'error', analysis_error: msg })
      .eq('id', a.id);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
