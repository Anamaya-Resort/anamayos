# Launch-Readiness Audit: Retreat + Leader Pages, Auto-Rendered from AnamayOS

Audit date: 2026-Jun-16. Scope: the two launch templates Geoff named — (1) Retreat page, (2) Retreat Leader page — plus the Retreats listing page and the AI helper that lets a leader dump raw text and have AO structure it.

---

## Headline finding

**The public website does not currently read AnamayOS retreat data at all.** Every public retreat surface (detail page, listing, even the homepage's hardcoded featured strip) renders WordPress snapshots that were captured during migration. The retreat-import pipeline pushes scraped data INTO AO, but the public site does not read it back out. That's the core gap to close before launch.

The only AO-fed blocks today are `FeaturedRetreatsBlock` (homepage tiles, lightly used) and `DetailsRatesDynamicBlock` (a pricing block on a specific opt-in retreat). Neither of those is wired into the templates we need.

---

## Surface 1 — Retreat detail page

Path: `/retreat/[slug]` in `src/app/(site)/retreat/[slug]/page.tsx`.

| Piece | Today | Needed |
|---|---|---|
| Page exists | Yes | — |
| Data source | WP snapshot (`url_inventory` + `content_items.scraped_body_html`) | AO `retreats` |
| Header (name, dates, tagline, hero image) | Frozen HTML | Native render of AO fields |
| Body sections (what's included, what to expect, itinerary, FAQs) | Single blob of frozen HTML | Discrete blocks, each reading AO structured fields |
| Pricing | Lives inside frozen body or via opt-in `DetailsRatesDynamicBlock` | A pricing block reading `retreat_pricing_tiers` on every retreat by default |
| Workshops | **Not rendered anywhere on the public site** | New `RetreatWorkshopsBlock` reading `retreat_workshops` |
| "About our Retreat Leaders" block | **Does not exist** | New `RetreatLeadersBlock` reading `retreat_teachers` + `retreat_leader_profiles`, one card per leader, linking to the leader's personal page |
| Editable-by-team after auto-fill | No — no override layer | Decide override model (see "Decisions" below) |

Verdict: **NOT BUILT** for the auto-fed model.

---

## Surface 2 — Retreat Leader personal page

| Piece | Today |
|---|---|
| Route at `/leader/[slug]`, `/leaders/[slug]`, `/teacher/[slug]`, etc. | **No route exists** |
| Block for leader detail | `PersonCardBlock` exists but is a generic card, manually filled, no AO read |
| Slug routing field | AO `retreat_leader_profiles.website_slug` exists and is populated by the import pipeline — but nothing consumes it |
| Editing UI on the website side | None |

Verdict: **NOT BUILT.** The data is in AO. The page does not exist.

---

## Surface 3 — Retreats listing page

Path: `/retreats` in `src/app/(site)/retreats/page.tsx`.

| Piece | Today | Needed |
|---|---|---|
| Page exists | Yes | — |
| Data source | WP snapshot (`url_inventory` for retreats, frozen HTML excerpts) | AO `retreats` |
| Sort | By WP `date_modified`, descending | By `start_date` (upcoming first, past after) |
| Upcoming vs past filter | None — everything in one list | Yes — at minimum, "Upcoming" / "Past" toggle |
| Pagination | None (hard limit 400) | Either pagination or grouped sections |
| Category split | Shown but not used | Optional |

Verdict: **PARTIAL.** The route exists but is WP-fed; needs an AO query + date logic.

---

## Surface 4 — AI helper for leaders writing their retreat

Goal stated: leader dumps stream-of-consciousness + notes + their existing website text; AI structures it into Anamaya's standard retreat format (tagline, what's included, what to expect, itinerary, FAQs, etc.).

| Piece | Today |
|---|---|
| Tables for brand voice + prompts | Built (`ai_brand_guide`, `ai_customer_archetypes`, `ai_content_prompts`) |
| AI generation endpoint | Built (`/api/admin/ai/generate`) — supports OpenAI, Anthropic, Google, X.ai, model-pickable |
| Retreat-specific content prompts seeded | **No** — no "draft retreat from raw notes" prompt exists |
| Leader-facing UI ("paste notes here → draft retreat") | **No** |
| Permission | The generation endpoint is admin-only (L5+); retreat leaders (L3) cannot call it |

Verdict: **NOT BUILT** for what you described. The plumbing exists; the leader-facing experience does not.

---

## What's already in good shape

These pieces are built and ready — the gaps are on the rendering + AI side, not the data-model side.

| Built | Notes |
|---|---|
| Leader self-serve retreat editor | Leaders with role `retreat_leader` (L3) can edit all structured fields on retreats they're assigned to — name, tagline, description, what_is_included, what_to_expect, itinerary, FAQs, pricing tiers, dates, location, etc. |
| Structured itinerary + FAQs | Real JSON/array fields with proper editor panels — not freeform |
| Workshops authoring | Leaders can add/edit workshops on their own retreats via `WorkshopsPanel` |
| Leader profile editor | Leaders can edit their own `retreat_leader_profiles` row (bio, photo, certifications, video, social links, slug, etc.) |
| Publish gate | Admin-only flip of `is_public` — appropriate, but leaders need to know their work waits for approval |
| Retreat-import pipeline | Wired and idempotent — scraped WP retreats are being staged on the website and can be pushed to AO |
| AO RLS for the website to read | `retreats`, `retreat_pricing_tiers`, `retreat_teachers`, `retreat_leader_profiles`, `retreat_workshops` (with caveat below), `general_testimonials` are all already anon-readable from the website |

---

## State of scraped data

This is the one piece I could not confirm from code alone — needs a live DB check before launch:

- The import pipeline (`src/lib/imports/`) is built and idempotent.
- I could not find a count anywhere in code of "how many retreats are currently staged in `retreat_imports`" vs "how many have been pushed to AO" vs "how many still need review."
- No status board exists in AO showing the import queue or what's incomplete (missing leader bio, missing workshop data, awaiting approval).

**Action**: run two count queries — one against the website's `retreat_imports` table (group by status), one against AO `retreats` — to know exactly where we stand. If they don't match the WP archive count, we know how many manual extractions are still needed.

---

## Known data drift to fix before relying on push

| Issue | Where | Why it matters |
|---|---|---|
| `push.ts` writes `session_count`, `duration_minutes`, `price_single` to `retreat_workshops` but those columns don't exist in AO | `src/lib/imports/push.ts` workshop section | Data silently dropped during push; workshops missing details |
| Imported leaders get placeholder emails `imported-{slug}@imported.anamaya.local` | Same file, persons creation | Admin must clean these up; no UI surfaces them |
| `retreat_leader_profiles.website_slug` populated but no route consumes it | Website routing | The whole point of slug is the leader page — easy fix once the page is built |

---

## What's missing for launch (concrete checklist)

Grouped by where the work happens.

### Website (anamaya-website)

1. **Retreat detail template — replace the WP-snapshot render with native AO blocks**
   - `RetreatHeroBlock` — name, tagline, dates, hero image from `retreats`
   - `RetreatOverviewBlock` — `description`, `what_to_expect`, `what_is_included` / `what_is_not_included`
   - `RetreatItineraryBlock` — `itinerary` JSON
   - `RetreatPricingBlock` — `retreat_pricing_tiers` (generalize the existing dynamic block so it auto-binds via the route's slug, not a manually-set retreat_id)
   - `RetreatWorkshopsBlock` — `retreat_workshops` for this retreat
   - `RetreatLeadersBlock` — for each row in `retreat_teachers`, fetch `retreat_leader_profiles`, render a card linked to `/leader/{website_slug}`
   - `RetreatFAQBlock` — `faqs` JSON
   - Page route at `/retreat/[slug]` resolves the AO retreat by `website_slug`, then renders the template

2. **Retreat Leader personal page — net new**
   - Route at `/leader/[slug]` resolving by `retreat_leader_profiles.website_slug`
   - Template with hero/bio/specialties/certifications/video/social/upcoming retreats blocks
   - Each block AO-fed; decide override layer (see Decisions)

3. **Retreats listing — switch to AO + date logic**
   - Query AO `retreats` where `is_public = true AND is_active = true`
   - Two sections: Upcoming (`end_date >= today`, sorted by `start_date` asc) and Past (sorted by `start_date` desc)
   - Pagination on Past, none on Upcoming
   - Generalize `FeaturedRetreatsBlock`'s query so it can be reused for the listing

4. **Override layer for website-team edits after auto-fill** — see Decisions

5. **Fix `FeaturedRetreats.tsx` hardcoded slugs** — replace with `FeaturedRetreatsBlock` once it's slug-routed consistently

### AnamayOS (anamayos)

6. **AI Retreat Composer (leader-facing)**
   - New leader-facing page in the retreat editor: a sidebar/tab where the leader pastes raw text and clicks "Generate"
   - Backed by a new prompt template seeded into `ai_content_prompts` — "draft a structured Anamaya retreat from these raw notes"
   - Output mapped to the retreat's structured fields with a per-field accept/reject UI (not blind overwrite — the leader has to confirm each section)
   - Permission gate: leaders (L3) can call it for retreats they own. Pull from `/api/admin/ai/generate` or build a new `/api/retreats/[id]/ai-compose` route with the right role check.
   - Pull `ai_brand_guide.compiled_context` as the system prompt so output is in Anamaya voice

7. **Fix `retreat_workshops` schema drift** — add the columns the push expects (`session_count`, `duration_minutes`, `price_single`) or drop them from the push payload. Pick one; pushing data that lands nowhere is a silent bug.

8. **Status board for Kelsey** (soft-blocker, but high value)
   - Dashboard view: how many retreats are imported, how many awaiting review, how many missing a leader profile, how many pushed but unpublished
   - "Preview on website" link per retreat — opens the (about-to-be-built) public page so admins can verify before flipping `is_public`

9. **Placeholder-email cleanup queue** — surface the `imported-*@imported.anamaya.local` persons so an admin can attach real emails before any leader-self-serve happens for them

---

## Decisions you need to make

1. **Override model for website-team edits.** When a retreat or leader page is auto-filled from AO but Kelsey wants to tweak the copy on the website, where does that override live? Three options:
   - **A. Edit in AO, never on website.** Simplest. Website always renders live AO data. Kelsey opens AO, edits the field, saves. (Recommended if you trust AO as source of truth.)
   - **B. Per-block overrides on the website.** Block has an `ao_override` field; if set, render the override, else render the AO data. (More flexible but doubles the editing surface.)
   - **C. Snapshot-on-publish.** When a retreat is published, snapshot AO into a website-local table; thereafter all edits happen on the website. (Decouples but loses live updates from AO.)

2. **AI Composer scope.** Is the leader-facing AI just for drafting (one-shot generate, then leader edits)? Or also for revising (highlight a paragraph, "make this shorter / more inviting")? First version can ship as one-shot only.

3. **Leader-page slug conflicts.** What happens if two leaders pick the same slug, or a leader changes their slug after their page is live? Need a uniqueness check + redirect logic on slug change.

4. **Past retreats** — do they keep their detail pages forever (good for SEO/archive) or get unpublished after some period? Affects pagination/listing logic.

5. **Workshops on the leader page.** Should a leader's personal page also list workshops they teach (across retreats), or only their retreats? Schema supports both.

---

## Suggested order

1. Run the live count check on `retreat_imports` + AO `retreats` so we know what's actually staged vs pushed.
2. Decide the override model (#1 above) — informs every block design.
3. Build the retreat detail template (native AO blocks). Biggest single unblocker.
4. Build the leader page route + template. Cleanest path: copy the retreat template pattern.
5. Switch the retreats listing to AO with date logic.
6. Build the AI Composer in AO.
7. Fix the workshop column drift + placeholder-email cleanup.
8. Add status board + preview link.
9. Replace homepage hardcoded `FeaturedRetreats.tsx`.

Items 1–5 are the launch path. 6–9 can ship after launch if 1–5 done in time.
