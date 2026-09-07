/**
 * Model bakeoff: tag the same images with several models and store
 * every result side by side in video_model_bakeoff.
 *
 * The point is to answer "which model should tag our library" with
 * the org's own photos rather than with a pricing table. Pricing says
 * Gemini Flash-Lite is 20x cheaper than Sonnet; only looking at the
 * tags and the boxes says whether that matters.
 *
 *   npx tsx src/scripts/bakeoff.ts [--limit N] [--models a,b,c] [--run ID]
 *
 * --run resumes an existing run: cells that already succeeded are
 * skipped, only gaps and errors are retried. Gemini returns 503 "high
 * demand" often enough that a single pass leaves holes, and a model
 * with holes cannot be compared fairly against one without.
 */
import 'dotenv/config';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// supabase-js constructs a RealtimeClient eagerly and Node 20 has no
// global WebSocket, so merely creating a client throws. Railway runs
// Node 22 (see nixpacks.toml) where this is a non-issue; this stub
// exists only so the script runs on a Node 20 laptop. Nothing here
// opens a realtime channel, so it is never actually called.
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = class {
    constructor() {
      throw new Error('realtime is not used by this script');
    }
  };
}
import { db } from '../db.js';
import { orgPrompt } from '../jobs/analyze.js';
import { tagImageWith, isRetryable } from '../ai/tag.js';
import type { ModelRole } from '../ai/models.js';

type Candidate = ModelRole & { key: string };

/**
 * Published rates, USD per million tokens, checked 2026-Sep-07.
 *
 * gemini-2.5-flash-lite is deliberately absent: it still appears in
 * the models list but generateContent returns 404 "no longer
 * available to new users". The cheap-Gemini case rested on 2.5
 * pricing, and 2.5 Flash-Lite is closed, so the honest current-
 * generation equivalent is 3.1 Flash-Lite.
 */
const CANDIDATES: Candidate[] = [
  {
    key: 'gemini-3.1-flash-lite', role: 'vision', providerId: 'google',
    modelEndpoint: 'gemini-3.1-flash-lite',
    inputPerMTok: 0.25, outputPerMTok: 1.50, cachedInputPerMTok: 0.025,
    supportsBatch: true,
  },
  {
    key: 'gemini-3.5-flash-lite', role: 'vision', providerId: 'google',
    modelEndpoint: 'gemini-3.5-flash-lite',
    inputPerMTok: 0.30, outputPerMTok: 2.50, cachedInputPerMTok: 0.03,
    supportsBatch: true,
  },
  {
    key: 'gemini-3.8-flash', role: 'vision', providerId: 'google',
    modelEndpoint: 'gemini-3.8-flash',
    // Introductory through 2026-Dec-31; doubles to 1.50/7.50 on 2027-Jan-01.
    inputPerMTok: 0.75, outputPerMTok: 3.75, cachedInputPerMTok: 0.375,
    supportsBatch: true,
  },
  {
    key: 'claude-haiku-4-5', role: 'vision', providerId: 'anthropic',
    modelEndpoint: 'claude-haiku-4-5',
    inputPerMTok: 1.00, outputPerMTok: 5.00, cachedInputPerMTok: 0.10,
    supportsBatch: true,
  },
  {
    key: 'claude-sonnet-5', role: 'vision', providerId: 'anthropic',
    modelEndpoint: 'claude-sonnet-5',
    inputPerMTok: 2.00, outputPerMTok: 10.00, cachedInputPerMTok: 0.20,
    supportsBatch: true,
  },
];

/** Long edge sent to the model. 768 is the Phase 2 recommendation. */
const TAG_PX = Number(process.env.TAG_PX ?? 768);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * Retry transient provider failures with exponential backoff.
 * Gemini answers 503 "experiencing high demand" on a meaningful
 * fraction of calls; without this the comparison would score that as
 * a quality failure rather than the capacity blip it is.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** i));
    }
  }
  throw lastErr;
}

async function main() {
  const limit = Number(arg('limit') ?? 60);
  const only = arg('models')?.split(',').map((s) => s.trim());
  const models = only
    ? CANDIDATES.filter((c) => only.includes(c.key))
    : CANDIDATES;
  if (models.length === 0) throw new Error('no candidates matched --models');

  const sb = db();
  const { data: assets, error } = await sb
    .from('video_assets')
    .select('id, org_id, file_name, proxy_path, thumb_path')
    .eq('is_deleted_on_drive', false)
    .eq('proxy_status', 'done')
    .like('mime_type', 'image/%')
    .not('proxy_path', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (assets ?? []) as {
    id: string; org_id: string; file_name: string; proxy_path: string;
  }[];
  if (rows.length === 0) throw new Error('no proxied images found');

  const runId = arg('run') ?? randomUUID();

  // Resume: never redo work that already produced a result.
  const done = new Set<string>();
  if (arg('run')) {
    const { data: existing } = await sb
      .from('video_model_bakeoff')
      .select('asset_id, model_key')
      .eq('run_id', runId)
      .is('error', null);
    for (const r of (existing ?? []) as { asset_id: string; model_key: string }[]) {
      done.add(`${r.model_key}:${r.asset_id}`);
    }
    console.log(`resuming run ${runId} - ${done.size} cells already complete`);
  }
  const orgId = rows[0].org_id;
  const { prompt } = await orgPrompt(orgId);

  console.log(`run ${runId}`);
  console.log(`${rows.length} images x ${models.length} models = ${rows.length * models.length} calls`);
  console.log(`system prompt: ${prompt.length} chars\n`);

  // Fetch each image once, reuse across every model, so all of them
  // see byte-identical input.
  //
  // Downscaled to TAG_PX first. The stored proxy is ~1237x848, which
  // is far more resolution than scene/subject/mood classification
  // needs: it roughly triples the image tokens and, measurably, the
  // wall-clock time, because the base64 payload dominates the request.
  // This is also what production should send, so the bakeoff measures
  // the configuration we would actually ship.
  // Cached on disk: pulling the proxies back out of Supabase storage
  // dominated the first run's wall clock, and a resumed run should
  // not pay it twice.
  const cacheDir = process.env.BAKEOFF_CACHE ?? '.bakeoff-cache';
  await mkdir(cacheDir, { recursive: true });

  const images = new Map<string, string>();
  const t0 = Date.now();
  for (const r of rows) {
    const cached = join(cacheDir, `${r.id}-${TAG_PX}.webp`);
    let small: Buffer;
    try {
      small = await readFile(cached);
    } catch {
      const dl = await sb.storage.from('video-proxies').download(r.proxy_path);
      if (dl.error || !dl.data) {
        console.warn(`  skip ${r.file_name}: ${dl.error?.message}`);
        continue;
      }
      small = await sharp(Buffer.from(await dl.data.arrayBuffer()))
        .resize(TAG_PX, TAG_PX, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
      await writeFile(cached, small);
    }
    images.set(r.id, small.toString('base64'));
  }
  console.log(`  (image prep took ${Math.round((Date.now() - t0) / 1000)}s)`);
  const avgKb =
    [...images.values()].reduce((a, b) => a + b.length, 0) /
    Math.max(1, images.size) /
    1024;
  console.log(
    `downloaded ${images.size} proxies, tagged at ${TAG_PX}px (avg ${avgKb.toFixed(0)} KB base64)\n`,
  );

  for (const m of models) {
    let ok = 0, failed = 0, micro = 0, ms = 0;
    process.stdout.write(`${m.key.padEnd(24)} `);

    for (const r of rows) {
      const b64 = images.get(r.id);
      if (!b64) continue;
      if (done.has(`${m.key}:${r.id}`)) {
        ok++;
        process.stdout.write('-');
        continue;
      }
      try {
        const t = await withRetry(() =>
          tagImageWith(m, { systemPrompt: prompt, imageBase64: b64 }),
        );
        micro += t.microCents;
        ms += t.latencyMs;
        ok++;
        await sb.from('video_model_bakeoff').upsert({
          run_id: runId, org_id: r.org_id, asset_id: r.id,
          model_key: m.key, provider_id: m.providerId,
          model_endpoint: m.modelEndpoint,
          summary: t.result.summary,
          aesthetic_score: t.result.aesthetic_score,
          tags: t.result.tags,
          detections: t.result.detections,
          archetype_fit: t.result.archetype_fit,
          input_tokens: t.inputTokens, output_tokens: t.outputTokens,
          cached_tokens: t.cachedTokens, micro_cents: t.microCents,
          latency_ms: t.latencyMs,
          // Explicit: an upsert leaves columns absent from the payload
          // at their previous value, so a cell that failed and later
          // succeeded on resume kept its old error text and still
          // counted as a failure in the report.
          error: null,
        }, { onConflict: 'run_id,asset_id,model_key' });
        process.stdout.write('.');
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        await sb.from('video_model_bakeoff').upsert({
          run_id: runId, org_id: r.org_id, asset_id: r.id,
          model_key: m.key, provider_id: m.providerId,
          model_endpoint: m.modelEndpoint, error: msg.slice(0, 500),
        }, { onConflict: 'run_id,asset_id,model_key' });
        process.stdout.write('x');
      }
      // Gentle on purpose: this runs without the backoff the worker
      // now has, and a bakeoff is not worth a rate-limit storm.
      await new Promise((r) => setTimeout(r, 120));
    }

    const usd = micro / 10_000 / 100;
    const per20k = ok > 0 ? (usd / ok) * 20_000 : 0;
    console.log(
      `\n  ok=${ok} failed=${failed}` +
      ` cost=$${usd.toFixed(4)}` +
      ` avg=${ok ? Math.round(ms / ok) : 0}ms` +
      ` -> 20k images = $${per20k.toFixed(0)}\n`,
    );
  }

  console.log(`\ndone. run_id = ${runId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
