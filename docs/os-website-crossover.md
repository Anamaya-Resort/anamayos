# AnamayOS ↔ Anamaya-Website Crossover Map

Status snapshot, 2026-Jun-16. Where the two codebases meet, what's live, what's half-built, what's planned.

---

## The two projects

| | AnamayOS (ops platform) | Anamaya-Website (marketing site) |
|---|---|---|
| Repo | `Anamaya-Resort/anamayos` | `Anamaya-Resort/anamaya-website` |
| URL | `ao.anamaya.com` | `anamaya.com` / `test.anamaya.com` |
| Local path | `/Users/geoffreymccabe/AnamayOS` | `/Users/geoffreymccabe/anamaya-website` |
| Supabase ref | `azvdmibriuqrmexwtrja` (AO DB) | `vytqdnwnqiqiwjhqctyi` (WEB DB) |
| Role | Source of truth for retreats, AI brand, org identity, media, pricing, leaders | Public render + page builder + WP-snapshot fallback |

Two completely separate Supabase projects. They do not share auth. Crossover happens **only through the website talking to the AO DB** — there is no AO→website webhook, no cron, no shared schema. AO is treated as a remote source the website pulls from (and pushes back to, for retreat imports).

---

## How the website talks to AO

Three credentials, one file. Website's `src/lib/ao-supabase.ts`:

- `aoSupabase()` / `aoSupabaseOrNull()` — **anon key**, server-side SELECT-only. RLS does the gating.
- `aoSupabaseAdmin()` / `aoSupabaseAdminOrNull()` — **service-role**, server-side only, used by the retreat-import push pipeline.
- `AO_ORG_SLUG` + `AO_ORG_ID` — resolves "which tenant is this site for" against AO.

Env vars on the **website** Vercel project:

```
AO_SUPABASE_URL
AO_SUPABASE_ANON_KEY
AO_SUPABASE_SERVICE_ROLE_KEY
AO_ORG_SLUG=anamaya
AO_ORG_ID=17567b4b-4d72-453d-a7bd-176b7aae3fa4
```

RLS pattern used on AO tables that the website needs: `CREATE POLICY "Anon read …" … USING (is_active = true)` (or `is_public AND approved_at IS NOT NULL` for reviews). Service-role bypasses these for the import push.

---

## Direction of flow

```
                ┌──────────────────────────────────────────┐
                │  Anamaya-Website (Next.js 16)            │
                │  WEB DB: vytqdnwnqiqiwjhqctyi            │
                │  - url_inventory / content_items (WP)    │
                │  - blocks / templates                    │
                │  - retreat_imports (staging)             │
                └─────────────┬────────────────────────────┘
                              │  ANON READ (RLS)            ▲
                              ▼                             │ SERVICE-ROLE
                ┌──────────────────────────────────────────┐│  WRITE
                │  AnamayOS (Next.js 16)                   ││  (retreat
                │  AO DB: azvdmibriuqrmexwtrja             ││   imports)
                │  - retreats / pricing / media / leaders  ││
                │  - ai_brand_guide / archetypes / prompts ││
                │  - organizations / org_properties        │┘
                │  - bookings (private)                    │
                │  - video_assets / segments (private)     │
                └──────────────────────────────────────────┘
```

Note: most flow is **AO → Website** (read). The one exception is the **retreat import pipeline**, which is **Website → AO** (push). Imports staged on the website, reviewed in the website admin, then pushed to AO with the service-role key.

---

## What's working today

### 1. AI brand context (AO → Website)

| Website file | AO table read | Use |
|---|---|---|
| `src/lib/ao-ai-context.ts` | `ai_brand_guide`, `ai_customer_archetypes`, `ai_content_prompts`, `ai_providers` | Feeds the visitor agent + AI sandbox in the website admin |

The compiled brand guide's `compiled_context` becomes the system prompt for AI features on the site. Per-org, filtered by `AO_ORG_ID`. React-cached per request.

### 2. Organization + property identity (AO → Website)

| Website file | AO table read | Use |
|---|---|---|
| `src/lib/ai/organization.ts` | `organizations`, `org_properties` | Booking URLs, tagline, locale, timezone, disclaimers, contact info — resolved per request, property overrides org |

### 3. AI provider config (AO → Website)

| Website file | AO table read | Use |
|---|---|---|
| `src/lib/ai/providers.ts` | `ai_providers` + `org_ai_provider_config` | Which models are "active" = AO says enabled AND website has the matching API key locally. Powers the model picker. |

### 4. Featured Retreats block (AO → Website)

| Website file | AO table read | Use |
|---|---|---|
| `src/components/blocks/FeaturedRetreatsBlock.tsx` | `retreats` (filtered `is_featured AND is_public AND is_active AND end_date >= today`) | Live retreat tiles. Image: tries `feature_image_url`, falls back through `images.large/full/medium/thumbnail`. Link: `website_slug` → `url_pattern` template. |

This is the cleanest, most production-shaped example of an OS-fed block. Future blocks should mirror its pattern.

### 5. Details + Rates dynamic block (AO → Website)

| Website file | AO table read | Use |
|---|---|---|
| `src/components/blocks/DetailsRatesDynamicBlock.tsx` | `retreat_pricing_tiers` (when block's `retreat_id` is set) | Live pricing on retreat pages. Computes `remaining`, "5 or fewer" / "Sold out" warnings. Falls back to `manual_tiers` array if AO unreachable or no `retreat_id`. |

### 6. Retreat import pipeline (Website → AO push)

| Website file | AO tables written | Use |
|---|---|---|
| `src/lib/imports/actions.ts` (extract + stage) | — | Reads WP HTML from `content_items.scraped_body_html`, AI-extracts via Claude, dedups images by sha256, stages JSON in website `retreat_imports` |
| `src/lib/imports/push.ts` (push) | `retreats`, `retreat_pricing_tiers`, `retreat_media`, `persons`, `teacher_profiles`, `retreat_teachers`, `retreat_workshops`, `general_testimonials` | Idempotent upsert keyed on `ao_retreat_id`. Re-push updates AO in place. |
| `src/app/admin/(default)/retreat-imports/` | — | Admin UI for review → push |

This is the **only place** the website writes to AO. Manual, admin-triggered, one retreat at a time.

### 7. Booking availability API (AO public REST)

| Endpoint | Use |
|---|---|
| `GET /api/bookings/availability?checkIn=…&checkOut=…&retreatId=…` (AO side) | Public, no auth. Returns per-room availability + bed-level detail. Website booking form + RG embed consume it. |

Not a DB read by the website — it's a REST call to AO's own API.

---

## What's partially wired

### 1. Homepage `FeaturedRetreats.tsx` (hardcoded)

`src/components/home/FeaturedRetreats.tsx` is **5 hardcoded retreats** with static slugs, dates, descriptions. Memory notes one of these slugs was already fixed once when it broke. **Action**: replace this component on the homepage with the existing `FeaturedRetreatsBlock` (or wire it to the same query). Until then, every retreat that ends needs a manual code edit.

### 2. Retreat detail page (still WP snapshot, not AO)

`src/app/(site)/retreat/[slug]/page.tsx` + `src/lib/retreats.ts` read from the website's own `url_inventory` / `content_items` / `media_items` — i.e. **frozen WordPress snapshots**, not live AO data. Even though AO has the canonical retreat record (we just pushed it there), the public detail page is still rendering the WP capture.

**Action (planned, not started)**: native render from AO's `retreats` + `retreat_media` + `retreat_pricing_tiers` + `retreat_teachers` + `retreat_workshops` + `general_testimonials`, replacing the snapshot path. This is the biggest remaining piece for full OS-driven retreat presentation.

### 3. Retreat listing `/retreats` (still WP snapshot)

Same story as detail page — listing reads `url_inventory` not AO `retreats`. Should follow detail page off WP onto AO.

### 4. Visitor agent retrieval

`POST /api/ai/ask` reads org + model config from AO, but **content retrieval is local** (website's `content_chunks` pgvector table). Agent will not see AO-only facts (e.g. live pricing changes, new retreat created in AO and not yet snapshotted on the site). Either index AO retreats into website `content_chunks` on push, or query AO live in the retrieval step.

### 5. `retreat_workshops` push — schema drift

`push.ts` writes `session_count`, `duration_minutes`, `price_single` but the AO `retreat_workshops` table doesn't have these columns. Push logs warnings; data silently dropped. **Action**: add the columns to AO or drop the fields from the push payload.

### 6. Imported teacher profiles use placeholder emails

`pushStagedRetreatToAO` auto-creates `persons` rows with `imported-{slug}@imported.anamaya.local` when it can't match a real person by name. Admin must correct before that person row is usable. Not a bug per se, but a manual cleanup step that's easy to miss.

---

## What's planned but not started

### 1. Video Maker output → website hero / blocks

| State | Detail |
|---|---|
| AO schema | `video_render_jobs.intent_destination` includes `public_marketing`; `video_platform_specs` includes `website_hero` (16:9, 30s); `video_asset_usages.exported` tracking exists |
| Permission gate | `video_asset_permissions.use_permission` enum includes `public_marketing_ok` |
| Wire to website | **None.** No anon RLS on `video_render_jobs`, no website consumer, `video-renders` bucket is private |

The whole pipeline was designed with this hand-off in mind but no website-side block reads from it yet. Natural first slice: a `VideoHeroBlock` that reads a render whose `intent_destination='public_marketing'` and `use_permission='public_marketing_ok'`.

### 2. Rooms → website (room pages, room blocks)

AO has full `rooms` schema (name, description, occupancy, rate, hero, gallery). **No anon RLS** → website can't read. The website's existing room modals are still hardcoded to anamaya.com WordPress URLs.

Two pieces needed: (a) anon-read RLS policy on `rooms`, (b) probably a `room_media` table mirroring `retreat_media` so gallery can be curated. Then build a `RoomsBlock` / room detail render.

### 3. Spa menu / Products → website

AO has `products` and `product_categories`. **No anon RLS.** No website consumer. Same pattern as rooms — add RLS, build a `SpaMenuBlock` that pulls live.

### 4. General testimonials surfacing on the public site

`general_testimonials` is read-enabled by RLS and the import pipeline writes to it, but there's no public-facing **testimonials block** yet. Adding one is small and unlocks reuse of the existing data.

### 5. Live retreat reviews block

Same — `retreat_reviews` exposed with the strict `is_public AND approved_at IS NOT NULL` gate, but no website block consumes it yet.

### 6. Leader profile pages / blocks

`retreat_leader_profiles` exposed. No public "meet the teachers" page or block pulls it. Easy win.

### 7. No real-time / event-driven sync

AO→website data is read on each request (anon RLS). No webhook, no cache invalidation event. Two consequences:

- Live blocks (FeaturedRetreats, DetailsRates) are always fresh, but every page hit is a DB read against AO. Watch hit rate as more blocks come online — Next caching + ISR or a website-side mirror table may be needed.
- WP-snapshot pages don't update when AO changes. That's the whole `retreat-imports` admin existing — manual mediation.

### 8. No website→AO push for anything except retreats

Forms, leads, booking inquiries on the site go to Sereenly / GHL / Retreat Guru, not back into AO. If you want those captured into AO's CRM/leads tables, that integration doesn't exist yet.

---

## Buggy / inconsistent / known traps

| Issue | Where | Fix shape |
|---|---|---|
| `FeaturedRetreats.tsx` hardcodes 5 retreat slugs | `src/components/home/` on website | Replace with `FeaturedRetreatsBlock` |
| `retreat_workshops` push references columns that don't exist in AO | `src/lib/imports/push.ts` | Add columns or drop fields |
| Imported leaders get fake emails | `pushStagedRetreatToAO` in `push.ts` | Manual cleanup post-import |
| Retreat detail page ignores AO retreat record after push | `src/app/(site)/retreat/[slug]/page.tsx` | Native AO render (planned, big) |
| Visitor agent retrieval doesn't see AO content | `POST /api/ai/ask` | Index AO into `content_chunks` on push |
| `video-renders` bucket private + no RLS on `video_render_jobs` | AO side | Decide on public-marketing gate, add policies |
| Memory mentions `cms_template_id` column referenced in `proxy/[...slug]` but not present in WEB DB | website-side latent | Migration 0016+ unapplied (per project memory) |

---

## Quick-reference: every AO table the website touches

### Read (anon, via RLS)

| AO table | Filter | Website consumer |
|---|---|---|
| `ai_brand_guide` | org_id | `ao-ai-context.ts` |
| `ai_customer_archetypes` | org_id | `ao-ai-context.ts` |
| `ai_content_prompts` | org_id, is_active | `ao-ai-context.ts` |
| `ai_providers` | none | `ao-ai-context.ts`, `providers.ts` |
| `org_ai_provider_config` | org_id | `providers.ts` |
| `organizations` | slug, is_active | `organization.ts` |
| `org_properties` | org_id, is_active | `organization.ts` |
| `retreats` | is_featured, is_public, is_active, end_date | `FeaturedRetreatsBlock.tsx` |
| `retreat_pricing_tiers` | retreat_id, is_active | `DetailsRatesDynamicBlock.tsx` |
| `retreat_media` | (open) | available, not yet rendered |
| `retreat_teachers` | (open) | available, not yet rendered |
| `retreat_leader_profiles` | is_active | available, not yet rendered |
| `retreat_reviews` | is_public AND approved_at | available, not yet rendered |
| `general_testimonials` | is_active | available, not yet rendered |

### Write (service-role, via retreat-import push)

| AO table | Operation |
|---|---|
| `retreats` | upsert by `ao_retreat_id` |
| `retreat_pricing_tiers` | replace all tiers for the retreat |
| `retreat_media` | gallery upsert |
| `persons` | match-by-name or create placeholder |
| `teacher_profiles` | upsert by person_id |
| `retreat_teachers` | link |
| `retreat_workshops` | upsert (with schema-drift warnings) |
| `general_testimonials` | insert |

### Storage buckets

| Bucket | Side | Read | Write |
|---|---|---|---|
| `retreat-images` / `retreat-media` | AO | public (via signed URL or open bucket) | retreat-import push |
| `retreat-leader-photos` | AO | public | retreat-import push |
| `video-renders` | AO | **private** (planned to expose for public_marketing) | worker |
| `snapshot` | WEB | public | WP snapshot capture |
| `site-media` | WEB | public | website admin |

---

## Recommended next moves (rough order of payoff)

1. **Kill hardcoded `FeaturedRetreats.tsx`** — replace with `FeaturedRetreatsBlock`. Stops the recurring manual-fix problem.
2. **Native AO render of retreat detail** — biggest single migration off WP snapshots and where most OS data is wasted today.
3. **Spa menu block** — RLS + block. Cheapest new public-facing OS-fed surface.
4. **Testimonials + leader-profile blocks** — data is already exposed, just build the blocks.
5. **Video hero block** — Video Maker has been built to feed exactly this, but the loop doesn't close yet.
6. **Rooms** — needs schema (room_media) + RLS + block. Bigger but high marketing value.
7. **Visitor-agent retrieval over AO content** — once detail pages are native-AO, this gets much simpler.

---

## File index

**AnamayOS — write/serve side**
- `supabase/migrations/00025_ai_data_sets.sql` — AI tables
- `supabase/migrations/00027_retreat_schema_expansion.sql` — retreats, pricing, media, leaders, reviews, testimonials
- `supabase/migrations/00029_org_identity_and_multi_tenant.sql` — orgs + properties
- `supabase/migrations/00032_anon_read_org_ai_provider_config.sql` — RLS for website
- `supabase/migrations/00034_retreat_workshops_and_storage.sql` — workshops
- `supabase/migrations/00041_video_maker.sql` — video pipeline schema
- `src/app/api/bookings/availability/route.ts` — public availability REST
- `src/config/app.ts` — module flags

**Anamaya-Website — consume/push side**
- `src/lib/ao-supabase.ts` — three AO clients
- `src/lib/ao-ai-context.ts` — AI tables fetcher
- `src/lib/ai/organization.ts` — org/property resolver
- `src/lib/ai/providers.ts` — model picker
- `src/components/blocks/FeaturedRetreatsBlock.tsx` — live retreats block
- `src/components/blocks/DetailsRatesDynamicBlock.tsx` — live pricing block
- `src/components/home/FeaturedRetreats.tsx` — hardcoded (replace)
- `src/lib/imports/actions.ts` — extract + stage
- `src/lib/imports/push.ts` — push to AO
- `src/app/admin/(default)/retreat-imports/` — admin UI
- `src/app/api/ai/ask/route.ts` — visitor agent
- `supabase/cross-project/ao_org_branding_public_read.sql` — cross-project RLS
