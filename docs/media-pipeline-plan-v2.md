# Media pipeline — platform review and phased plan (v2)

Written 2026-Sep-03. Supersedes the ordering in `media-library-roadmap.md`;
that document's feature descriptions still stand.

---

## 1. The finding that reframes everything

The pipeline processes **4 images per minute.**

`analyzePendingAssets` claims a batch of 4 and runs them one after another;
pg-boss fires it once a minute. The proxy job is 8 per minute on the same
pattern. Videos are 1 per 2 minutes.

| Library size | Time to tag, as built |
|---|---|
| 59 (today) | 15 minutes |
| 2,000 | 8 hours |
| 20,000 | **83 hours** |

Twenty thousand is the crawler's own ceiling, so that is the shape of the
"point it at the whole Drive" request. Three and a half days.

This is not a Railway limitation. An always-on container is sitting idle
more than 95% of the time while a cron tick doles out four images. The
constraint is the design: **a scheduler pretending to be a queue.**

pg-boss is in the stack and its actual features — per-job concurrency,
retries, backoff, dead-letter — are entirely unused. It fires a timer; the
timer runs a `SELECT ... LIMIT 4`. Everything pg-boss is for was rebuilt,
worse, as status columns on `video_assets`.

**Any platform decision made before fixing this is measuring the wrong
thing.** Moving to Cloudflare unchanged buys you four images a minute on
Cloudflare.

---

## 2. Where the money actually goes

Per-image vision tagging, at the 1280px proxy the worker currently sends:

| Model | $/1M in | $/1M out | Per image | **20,000 images** |
|---|---|---|---|---|
| `claude-sonnet-4-6` *(pinned today)* | $3 | $15 | ~$0.0149 | **~$298** |
| `claude-sonnet-5` | $2 | $10 | ~$0.0099 | ~$199 |
| `claude-haiku-4-5` | $1 | $5 | ~$0.0050 | ~$99 |
| Gemini 2.5 Flash *(already wired for video)* | $0.30 | $2.50 | ~$0.0021 | ~$42 |

Add the Batch API (50% off, and bulk library tagging is the textbook case
for it) and Haiku lands near **$50**. Drop bounding-box detections from the
bulk first pass — they exist for the Scan Theater animation and for
face-aware cropping later, not for search — and it is nearer **$35**.

Now the infrastructure, same 20,000 images:

| Platform | Cost for the scan | Cost when idle |
|---|---|---|
| Cloudflare Containers | ~$1 | $0 |
| Railway (always-on) | included | ~$5-20/month regardless |

**The platform choice is worth about $20 a month. The model and batching
choices are worth about $260 per full library scan.** That ratio should
decide the order of work, and it is why the plan below puts a one-line
model change and a batching change ahead of any migration.

Two related findings:

- The model IDs are **hardcoded** in `workers/video-worker/src/ai/vision.ts`
  and `jobs/analyze.ts`. Migration 00041 created `video_maker_model_roles`
  precisely so they would be configurable rows. It has never been read from
  or written to. Changing model today means a code edit and a redeploy.
- `video_cost_ledger` and `video_org_quotas` were created in the same
  migration and are also never written. Every call computes its cost and
  throws the number away into a column nothing displays. There is no
  spend ceiling anywhere, which is uncomfortable next to a job that can
  spend $300 unattended.

---

## 3. Is Railway still right?

Short answer: **yes for now, and the question is worth less than it looks.**
But the honest comparison, since it was asked:

### What the work actually requires

Native `sharp`/libvips, `sharp-phash`, and `ffmpeg` binaries; local disk for
video files up to 2 GB; single operations that legitimately run for minutes;
outbound HTTPS; a Postgres connection.

### Cloudflare Workers alone — **no**

No native modules, so no sharp and no ffmpeg. The image path could be
rebuilt on the Images binding or WASM, but pHash has no equivalent and the
video path is impossible. Not a candidate.

### Cloudflare Containers — **a real candidate, and better than I expected**

It went **GA on 2026-Apr-13** (my cached reference still said beta — worth
correcting). Active-CPU billing at $0.000020/vCPU-second means a burst
workload like this costs about a dollar per full scan and nothing at rest,
which fits the actual usage pattern — scan a Drive, then nothing for weeks
— far better than an always-on box. Account ceilings are now generous
(1,500 vCPU, 6 TiB memory).

Against it: **no autoscaling** — you spread load yourself across instances.
Containers are addressed as Durable Objects and are request-driven, which
is an awkward shape for a background consumer. And it is a third platform
to operate alongside Vercel and Supabase, with its own config, secrets and
deploy path, for a saving that AI spend dwarfs.

### Cloudflare Images / Stream — **worth taking for the media, not the compute**

- **Images** ($0.50/1,000 transformations, $5/100k stored/month) could
  replace the thumbnail and proxy generation outright, and it would serve
  them faster than signed Supabase URLs. It cannot compute a pHash, and the
  worker needs the decoded bytes for the vision call anyway, so it removes
  less work than it first appears.
- **Stream** ($5/1,000 minutes stored, $1/1,000 delivered) genuinely could
  replace the whole ffmpeg transcode path, which is the single most
  operationally annoying part of the worker. Worth revisiting if video ever
  becomes a real volume rather than a handful of files.

### Vercel functions — **the option with no new platform**

The image path is download → resize → encode → hash → upload → one API
call. That is I/O-bound with a short CPU burst, it already has a home
(Vercel, where the app lives, and Next.js ships sharp), and it fans out to
high concurrency for free. Only the video path genuinely needs a container.

The catch is putting sustained heavy work next to the user-facing app and
the cost-surprise surface that comes with per-invocation billing.

### Recommendation

**Stay on Railway. Fix the concurrency. Make the platform swappable, and
re-decide with real numbers.**

Railway is a container host that already works and is the right tool for
ffmpeg and long jobs. The reason to move would be scale-to-zero economics
on bursty scans, and that reason is worth ~$20/month today while the same
effort spent on model choice and batching is worth ~$260 per scan.

The one thing worth doing now is structural: keep all platform-specific
concerns (queue driver, storage driver, process supervision) behind small
interfaces so that a later move to Cloudflare Containers is a week, not a
rewrite. Phase 2 does that as a side effect of fixing throughput.

Revisit the migration when any of these becomes true: full-library scans
become a weekly rather than occasional event; video volume grows enough
that Stream would pay for itself; or Railway costs exceed roughly $50/month.

---

## 4. The plan

### Phase 1 — Stop overpaying (small, immediate)

1. Move image tagging to `claude-sonnet-5` — newer and 33% cheaper than the
   pinned `claude-sonnet-4-6`. One-line change; do this regardless of
   everything else.
2. Read model IDs from `video_maker_model_roles` instead of hardcoding, so
   the next change is a database row rather than a redeploy.
3. Write `video_cost_ledger` on every call and show the total per source in
   the UI. Fix the rounding while there — costs are `Math.ceil`'d to whole
   cents per call, so a 0.2c image books as 1c and a large run overstates
   spend several times over.
4. Add a per-org monthly ceiling that pauses the queues. `video_org_quotas`
   already exists. Nothing unattended should be able to spend $300 silently.

*Exit test: a scan reports what it cost, and cannot exceed a set budget.*

### Phase 2 — Make it fast (the real unlock)

5. Replace the cron-tick-plus-fixed-batch with a **continuous concurrent
   consumer**: one job per asset, bounded concurrency (start at 8, tune),
   the worker pulling work as it finishes rather than waiting for the next
   minute. Use pg-boss properly — its retries, backoff and dead-letter
   queue replace the hand-rolled status-column state machine.
6. **Add rate-limit handling, before raising concurrency.** There is none
   anywhere in the worker today. The Anthropic SDK retries twice by
   default; past that a 429 marks the asset permanently failed and burns
   one of its three attempts. At concurrency 8 this will happen. Needs
   explicit 429 detection, exponential backoff, and 429 not counting
   against the attempt budget.
7. Route bulk scans through the **Batch API** — 50% off, and it removes
   per-image latency from the critical path entirely. Interactive
   re-tagging of a single image stays on the live API.
8. Tag from a **768px** render rather than the 1280px proxy. Scene, subject
   and mood classification does not need the extra pixels, and it is about
   a third of the input tokens.

*Exit test: 20,000 images tagged in hours, not days, with a known bill.*

### Phase 3 — Make it durable

9. **Originals archive.** Supabase currently holds a 1280px proxy and a
   400px thumbnail; the full-resolution file never leaves Google Drive.
   Reorganise that Drive and the portfolio degrades to thumbnails. New
   `video-originals` bucket, streamed copy, md5 verified, opt-in per source
   with the projected storage shown before it is switched on.
10. Write `is_deleted_on_drive` on rescan. The column exists; nothing sets
    it, so deletions in Drive are invisible.
11. Populate `priority_score` or drop the ordering that depends on it. The
    review queue sorts by it and it is always 0.

### Phase 4 — The actual product

12. **Caption studio.** The feature this project was started for, and it
    does not exist in any form. Per-channel branded captions generated from
    what the library already knows — summary, tags, aesthetic score,
    archetype fit — combined with the compiled brand guide the website's
    visitor agent already uses. Three variants per channel, bulk mode over
    any filtered set, human edits stored rather than overwritten, and a
    hard gate so an image below `organic_social_ok` cannot get a public
    caption. Website alt-text as a separate, deliberately plain channel.
13. **Semantic search and collections.** `video_asset_embeddings` exists
    with an HNSW index and has never had a row written. Embed summary plus
    tags, rank blended with aesthetic score, cluster near-duplicates using
    the pHashes already computed. Collections are the unit the website and
    the caption studio should consume.
14. **Publish path.** Read-only API over approved, permission-cleared
    assets, consumed by the website the same way it already reads retreats
    and brand context from the AO database.

### Phase 5 — Re-decide the platform

15. With Phases 2-4 done there will be real numbers: actual scan
    frequency, actual Railway bill, actual video volume. Re-run the
    comparison in section 3 against them. If bursty scans dominate,
    Cloudflare Containers wins on economics and the interfaces from Phase 2
    make the move small. If video volume has grown, Stream is the bigger
    win than the compute platform.

### Parked

The original video-maker slices — timeline, render, music, platform specs,
campaigns. The JSON-Patch timeline in `types.ts` is fully designed and
entirely unimplemented. A captioned, searchable image library is useful on
its own; the video editor is not useful without one.

---

## 5. Ordering rationale

Phase 1 is hours of work and pays for itself on the first scan. Phase 2 is
the difference between a feature that can be pointed at a Drive and one
that cannot. Phase 3 is insurance against a Drive reorganisation. Phase 4
is the thing that was actually asked for. Phase 5 is a decision that should
be made with data instead of ahead of it.

The temptation is to do Phase 5 first, because a platform migration feels
like the decisive move. It is the least valuable item on this list.
