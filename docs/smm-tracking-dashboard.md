# Social Media Marketing Tracking (`/smm_tracking`)

One place showing Ad Spend → Leads → Bookings → Revenue, with AnamayOS as the
source of truth for outcomes and the ad platforms as the source for spend.
Requested by Sandra Young; built 2026-Oct-29.

Live at `https://ao.anamaya.com/smm_tracking` (manager access, L4+).

## 1. Purpose and goals

Answer three questions without opening four ad dashboards:

- What did we spend, and what did it produce?
- Which retreat is actually selling?
- What should we change next? (0N1X-2 advises against live figures and goals.)

Sandra's V1 metric row is the KPI grid: Spend, Leads, CPL, Bookings, Cost per
Booking, Revenue, ROAS, plus lead-to-booking rate. Filterable by platform,
placement and date range.

## 2. Non-negotiable requirements

- **A missing number renders as a dash plus the reason, never a zero.** A zero
  reads as "we failed"; "Awaiting ad account" reads as "not connected". The
  `Kpi.blockedBy` field carries that reason.
- **Revenue is charges less discounts on `transactions` rows where
  `class = 'item'`.** Not `grand_total` across all rows: that mixes payments
  with refunds, nets against `wire_transfer` payouts to retreat leaders, and
  excludes every actual charge. The wrong version reported $31,703 against a
  true sold figure of $68,795 and made revenue-by-retreat all zeroes.
  Cash collected is a separate figure (`grand_total` on `card_payment` /
  `non_cc_payment`). **0N1X-2 must use the same calculation** or the advisor
  contradicts the tiles.
- **Secrets are write-only.** Tokens go to `marketing_secrets` (service role
  only); the UI gets back `last4` and nothing else.
- **No hard-coded styling.** The only hard-coded colours in the module are the
  platform brand marks in `platform-logos.tsx`, which are third-party
  trademarks, not theme values.
- **Route protection is default-deny** — see Gotchas.

## 3. Architecture

Server components throughout. Tabs, placements and the range picker are links,
not client state, so every view is a shareable URL and the page stays server
rendered. Only three pieces are client components: the gear, the goals sheet
and the 0N1X-2 widget.

| Path | What it is |
|---|---|
| `src/app/(dashboard)/smm_tracking/page.tsx` | The page. Reads `searchParams`, guards the session, fetches, renders. |
| `src/modules/marketing/queries.ts` | Every read. `getOutcomes`, `getRetreatOutcomes`, `getPlatformSummary`, `getGoals`, `getCreatives`. |
| `src/modules/marketing/constants.ts` | `DASH_PATH`. The route is spelled out once. |
| `src/modules/marketing/kpi-grid.tsx` | Sandra's eight tiles. |
| `src/modules/marketing/dash-tabs.tsx` | Platform tabs (logo + name) and the range picker. |
| `src/modules/marketing/retreat-table.tsx` | Revenue by retreat. |
| `src/modules/marketing/creative-table.tsx` | Per-ad breakdown; waiting state until a connector runs. |
| `src/modules/marketing/goals-card.tsx` | Targets measured against live figures. |
| `src/modules/marketing/goals-panel.tsx` | The target button: create / list / delete goals. |
| `src/modules/marketing/connections-panel.tsx` | The gear. Reads back saved state per platform. |
| `src/modules/marketing/onix-launcher.tsx` | 0N1X-2, bottom right. |
| `src/app/api/admin/marketing/connections/route.ts` | GET (L5+) returns settings + masked secrets; POST saves one field. |
| `src/app/api/admin/marketing/goals/route.ts` | GET (L3+), POST / DELETE (L5+). |
| `src/app/api/admin/onix/chat/route.ts` | 0N1X-2. Context assembled server-side. |
| `supabase/migrations/00064_marketing_dashboard.sql` | The ten tables. |

### Tables

`marketing_platforms` (seeded: instagram 10, facebook 20, tiktok 30, google 40,
each with its placement list), `marketing_settings` (non-secret, readable),
`marketing_secrets` (service role only) + `marketing_secret_status` view,
`ad_entities`, `ad_spend_daily`, `marketing_sync_log`, `marketing_goals`,
`onix_knowledge`, `onix_messages`.

### 0N1X-2

Model `claude-opus-5-5`, explicit `effort: medium`, server-side refusal
fallback (`server-side-fallback-2026-07-01`, `fallbacks: "default"`), raw HTTP
rather than the SDK so the route adds no dependency. The system prompt is two
blocks: persona + knowledge base, marked `cache_control: ephemeral` because
they are identical every turn, then the live figures after the break.
`max_tokens` is 8000 because thinking is always on for this model and shares
the budget. 18 knowledge entries seeded across meta / foundations / anamaya /
google / tiktok.

Avatar: `general-media/onix2/onix2-avatar.png` in AO Supabase storage.

## 4. Gotchas and hard-won knowledge

- **Route protection used to be prefix-based on `/dashboard`.** The page first
  shipped at `/dash`, outside that prefix, so it was never guarded and served
  live revenue and retreat names to anonymous visitors. `protectRoutes` in
  `src/lib/supabase/middleware.ts` is now default-deny: only `/`, `/login`,
  `/auth` and `/api` are public. **Any new top-level page is protected by
  default** — that is the point. API routes stay out because each checks the
  session itself and must answer JSON, not an HTML redirect.
- **The middleware matcher must skip anything with a file extension.** It
  originally listed only image extensions, so default-deny would have
  redirected `/sounds/button_tone_1-1.mp3` — the click sound, initialised from
  the root layout and used by the login button itself.
- **Postgres views ignore RLS by default.** `marketing_secret_status` let the
  anon key list which secrets exist plus their `last4`. Fixed with
  `ALTER VIEW ... SET (security_invoker = true)`. Verified with a canary token,
  not by reading the design.
- **`transactions.revenue` is a jsonb column**, not numeric. `sum(revenue)`
  fails.
- **The sidebar resolves icons through a map** in
  `src/components/layout/sidebar.tsx`. An icon name not in that map renders
  nothing, silently — the nav row shipped iconless for exactly that reason.
- **`leads` has 2,366 rows, all `source='abandoned-reg'`** from one Retreat
  Guru import on 2026-Apr-09, with no UTMs. So the Leads tile correctly shows 0
  for any recent window, and cost per lead cannot be real until attribution
  lands. This is expected, not a bug.

## 5. Open problems and next steps

- **Verify `ANTHROPIC_API_KEY` in the AO Vercel production environment.** Without
  it 0N1X-2 returns 503 and the widget says so. Not checkable from here: no
  Vercel CLI and no Vercel token on this machine.
- **Phase 5 — platform connectors.** Schema and UI are built and dormant.
  Each connector writes `ad_spend_daily` + `ad_entities` and logs to
  `marketing_sync_log`. Gated on credentials.
- **Phase 6 — attribution.** UTM capture on the website, a Sereenly/GHL webhook
  into `leads`, and booking-to-lead linking. Until this exists, every
  spend-derived metric is blended at best.
- **Goals are create/delete only** — no edit in place.
