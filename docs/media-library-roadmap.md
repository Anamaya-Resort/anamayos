# Media Library — roadmap beyond Slice 5

Written 2026-Aug-05, straight after the Slice 0-5 audit (migration
00048). This is the plan for turning what exists — a Drive importer
that tags images with AI — into the branded image portfolio the
feature was actually asked for.

Module: `src/modules/video/` · worker: `workers/video-worker/`

---

## What already works today

Worth stating plainly, because one of these was assumed missing:

**Paste a Drive link and everything under it gets ingested.** This
exists and is the primary path. Dashboard → Video Maker → Add folder →
"Paste a link" tab. Accepts an address-bar URL, a share link, or a bare
folder ID. It then:

1. Validates the folder is reachable by that Google account.
2. Walks the whole tree recursively — every subfolder, 25 levels deep,
   up to 20,000 files — picking up every image, video and audio file.
3. Records each file with its Drive path, size, dimensions, EXIF
   capture date and md5.
4. Downloads each image, generates a **400px WebP thumbnail and a
   1280px WebP proxy**, uploads both to the private Supabase
   `video-proxies` bucket, and perceptual-hashes it for dedupe.
5. Runs Claude Sonnet 4.6 vision against the controlled Anamaya
   vocabulary — subject, activity, mood, people, marketing-use — plus
   an aesthetic score, a one-line summary, face and object bounding
   boxes, and a fit score against each customer archetype.
6. Surfaces it for human review with a privacy/consent decision.

So "send a Drive link, scan every folder, categorise, convert to WebP,
land it in Supabase" is **done**. The gaps are below.

---

## Gap 1 — the originals never leave Google Drive

The biggest structural gap. Supabase holds a 1280px proxy and a 400px
thumbnail. The full-resolution original stays in Drive and is fetched
on demand. That means the "portfolio" cannot produce a print-quality or
even web-hero-quality file on its own, and if somebody reorganises or
deletes the Drive folder, the library degrades to thumbnails.

**Slice 6A — Originals archive.**

- New `video-originals` private bucket; `original_path` +
  `original_bytes` on `video_assets`.
- Worker job `archive.ts`: stream the Drive original into the bucket
  (stream, never buffer — some of these are large), verify the md5
  matches Drive's, record the path.
- A large WebP derivative (2560px, quality 82) alongside it, which is
  what the website should actually consume.
- Storage cost is the real constraint, so this is opt-in per source
  ("archive originals from this folder") rather than automatic, with
  the projected GB shown before you switch it on.
- Detect files that vanished from Drive on rescan and set
  `is_deleted_on_drive` — the column exists and nothing ever writes it.

## Gap 2 — no branded caption writing

This is the feature that prompted the whole project and it does not
exist in any form. The `caption` model role in `types.ts` is video
subtitles, not marketing copy.

**Slice 6B — Caption studio.**

- `video_asset_captions`: asset_id, channel (instagram / facebook /
  website-alt / email / print), variant index, body, hashtags, tone,
  model, cost, status (draft / approved), edited_by.
- Generation reads what the library already knows — the AI summary,
  the tag set, the aesthetic score, the archetype fit, the capture date
  and Drive path (which often encodes the retreat or event) — and
  combines it with the org's compiled brand guide from
  `ai_brand_guide.compiled_context`, the same context the website's
  visitor agent uses. Captions therefore sound like Anamaya rather than
  like a stock caption generator.
- Three variants per channel per image, so there is something to choose
  between rather than accept or regenerate.
- Bulk mode: select any filtered set and caption all of them, with the
  brand context cached across the run exactly as the vision prompt is —
  that is what makes a 600-image run affordable.
- Human editing is first-class and edits are stored, not overwritten by
  the next generation.
- Hard requirement: an image whose `use_permission` is below
  `organic_social_ok` cannot have a public-channel caption generated.
  The permission model already exists; it must gate this too.
- Website alt-text is a separate, deliberately plain channel — it is an
  accessibility artefact, not marketing copy.

## Gap 3 — the library is browsable but not searchable

Filename and tag search now work (added in the audit). Meaning-based
search does not. `video_asset_embeddings` exists with an HNSW index and
has never had a row written to it.

**Slice 6C — Semantic search + collections.**

- Worker job: embed each asset's summary + tag set, write to the
  existing table.
- Search box accepts natural language ("golden hour by the pool, nobody
  recognisable") and ranks by cosine similarity, blended with the
  aesthetic score so good photos surface above merely relevant ones.
- Near-duplicate clustering using the pHashes already computed — right
  now only byte-identical files are caught, so twelve frames of the
  same burst all sit in the library as separate assets.
- **Collections**: named, ordered, hand-curatable sets ("Homepage
  hero pool", "Yoga teacher training 2026"). This is the unit the
  website and the caption studio should consume, not raw filters.

## Gap 4 — nothing consumes the library

AnamayOS tags images; the website has its own separate media page that
knows nothing about any of it.

**Slice 7 — Publish path.**

- Read-only API on AnamayOS exposing approved, permission-cleared
  assets by collection or tag, with signed URLs and the stored alt
  text.
- The website reads it the same way it already reads retreats and brand
  context from the AO database (anon key, RLS-gated) — the pattern in
  `docs/os-website-crossover.md`. No new trust boundary.
- Publishing an asset from a collection into a page block, with the
  caption and alt text travelling with it.

## Gap 5 — cost and quota are invisible

Every AI call records `analysis_cost_cents`, and nothing ever displays
it. There is no per-org budget and no way to answer "what did tagging
this folder cost".

**Slice 8 — Cost and quota.**

- Spend panel: per source, per month, per model, per job kind.
- Per-org monthly ceiling that pauses queues rather than silently
  overspending. `video_ai_quotas` already exists in migration 00041.
- Fix the rounding while here: costs are `Math.ceil`'d to whole cents
  per call, so a 0.2c image is booked as 1c and a large run overstates
  spend several-fold.

---

## The original video-maker slices, still unbuilt

These are the empty `.gitkeep` folders. They stay parked below the
portfolio work, since a captioned, searchable image library is useful
on its own and the video editor is not useful without it.

- **Timeline + render** (`timeline/`, `render/`) — the versioned
  JSON-Patch timeline in `types.ts` is fully designed and entirely
  unimplemented. FFmpeg filtergraph rendering, permission-gated so a
  clip cannot be rendered into a destination its consent does not
  allow.
- **Music** (`music/`) — licensed track library with rights metadata.
- **Platforms** (`platforms/`) — data-driven aspect/duration/safe-zone
  specs per platform, not hardcoded.
- **Campaigns** (`campaign/`) — scripts, then shot selection driven by
  the tag and embedding data above.

---

## Suggested order

1. **6B Caption studio** — the actual ask, and it needs nothing new
   from the pipeline. Highest value per unit of work.
2. **6C Semantic search + collections** — makes a library of thousands
   navigable, and gives captioning something to operate on in bulk.
3. **6A Originals archive** — the durability fix. Worth doing before
   the library gets much bigger, and before anyone reorganises Drive.
4. **7 Publish path** — connects it to the website.
5. **8 Cost and quota** — before any large unattended run.
6. Video slices, if and when video becomes the priority.

---

## Operational notes carried out of the audit

- The Railway worker must be redeployed for the worker-side fixes to
  take effect, including the heartbeat that the new "worker offline"
  banner reads. Until it redeploys, that banner will show.
- `priority_score` is ordered on by the review queue and is never
  written — every asset is 0, so ordering falls through to newest
  first. Either populate it (aesthetic score, face count, recency) or
  drop the ordering; leaving it is misleading.
- `MAX_FILES = 20000` in the crawler truncates silently. Anything
  approaching that needs a visible warning, not a quiet stop.
- HEIC images will fail proxy generation unless sharp is built with
  libheif. iPhone-sourced folders are the likely first casualty; the
  new attempt counter means they now fail three times and stop rather
  than retrying forever.
