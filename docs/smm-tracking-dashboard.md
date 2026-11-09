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

## 3a. GA4 and Search Console

Connected 2026-Oct-29 through the existing SEO service account
`anamaya-seo-bot@anamaya-seo.iam.gserviceaccount.com`. No new Google project
or credential was needed.

- GA4 property `371232847` via the Data API. Live check: 6,676 sessions /
  5,030 users / 235 conversions over 28 days.
- Search Console `sc-domain:anamaya.com` via webmasters/v3 Search Analytics.
  Live check: 2,114 clicks / 53,357 impressions / position 11.4 over 28 days.
- The same service account also has Full access to 13 other GSC domain
  properties (costaricajourneys.com, montezumabeach.com, santa-teresa.com,
  scuba.cr and others), so the site registry can cover those too.

**A new subdomain usually needs no new Google property.** Verified: GA4
property 371232847 already reports `go.`, `staging.`, `test.` and
`awaken.anamaya.com` under its `hostName` dimension, and a Search Console
DOMAIN property covers every subdomain by definition. So adding
`cookbook.anamaya.com` means reusing the parent's property ids and setting
two filters — `ga4_hostname` (exact match on hostName) and `gsc_page_filter`
(page contains). The admin form prefills all four from the domain you type.

A subdomain with its own separate GA4 property is also supported: just put
that property id on the row and leave the hostname filter empty.

**Where the credential lives.** The service account JSON is stored in
`marketing_secrets` under `platform_key='google_analytics'`, not in an env
var, so it can be rotated from the gear without a redeploy and so production
works without a Vercel change. `GOOGLE_SERVICE_ACCOUNT_JSON` overrides it if
set. Verified the anon key reads nothing from `marketing_secrets` or
`marketing_sites`.

`marketing_platforms` gained a `kind` column for this: the Google Analytics
row holds a credential and must not become a dashboard tab, so `getPlatforms`
filters `kind='ads'`.

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

## 3b. Monthly occupancy chart

`src/modules/marketing/occupancy.ts` + `occupancy-chart.tsx`. Grouped bar
chart: 12 month slots on the x axis, one bar per year side by side inside
each slot, y axis the number of confirmed bookings in house. Hand-rolled
SVG, no charting dependency; colours come from the existing `--chart-1..5`
tokens in `src/app/globals.css`, newest year on `--chart-1`.

A booking counts once for every week its retreat runs, so a 3 week
teacher training adds 1 to each of 3 weeks. The span is derived from the
retreat's own `start_date`/`end_date`, never from its name: measured on
live data, 164 retreats are 7 days, 11 are 21 days, and those 11 are
exactly the teacher trainings, so the dates already encode the rule.
Verified total: 1,155 confirmed bookings produce 1,293 booking-weeks,
which equals 1,155 + 2 x 69 bookings sitting on a 3 week retreat. Each of
those weeks is filed under the calendar month its own start date falls in.

Verified monthly figures as of 2026-Nov-09 (2024 / 2025 / 2026 / 2027):
Jan 3/35/34/9, Feb 37/36/42/14, Mar 58/40/61/4, Apr 64/12/18/6,
May 45/44/2/0, Jun 34/26/21/5, Jul 24/49/10/2, Aug 40/45/17/1,
Sep 4/14/26/0, Oct 21/8/57/0, Nov 50/71/51/0, Dec 71/44/38/0.
Totals 451 / 424 / 377 / 41.

Things this code already handles:

- **Pagination is mandatory here.** This query spans all history, which
  is already over PostgREST's silent 1,000 row cap (1,333 bookings).
  Without the paging helper the earliest years undercount with no error.
  Note the other marketing queries are *not* paginated; they are safe only
  because the longest range the UI offers is 12 months (447 rows). Adding
  an "all time" range option would silently understate revenue.
- **Monthly buckets, not weekly.** The first version used weeks and had to
  fight two separate bugs for it. Day-of-year buckets drifted against the
  Saturday retreat start and grew phantom empty weeks; switching to ISO
  weeks fixed that but introduced a worse one, because ISO week 53 of 2026
  contains 2027-01-02, so the New Year retreat's 9 bookings drew on the
  2026 line and understated the year being watched for pace. Calendar
  months have neither problem: the month comes straight off the date.
- **No date range.** The page's range picker is deliberately not applied.
  A seasonality view only reads with whole years side by side.
- **2024 is partial.** Booking records begin 2024-Jan-22, which is why
  January 2024 reads 3 rather than being empty. The footnote says so.

Months reading 0 are real: months with no retreat running. Every plotted
number is also printed in the table beneath the chart, with a totals row,
so nothing depends on hovering.

Month names come from `Intl.DateTimeFormat` with the session locale
rather than the dictionary, because `TranslationKeys` is a deep *string*
record and rejects an array of month names.

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
- **Search Console switches aggregation when you filter.** An unfiltered
  domain query aggregates `byProperty`; the moment a page filter is applied it
  aggregates `byPage`, and the totals differ. Measured on anamaya.com over 30
  days: whole domain 54,935 impressions, page-contains `www.anamaya.com`
  69,434. So a filtered subdomain row will never sum to the whole-domain row.
  The table footnote says this out loud rather than letting someone conclude
  the numbers are broken.
- **Search Console data lags about two days.** Asking for today returns zeros
  and makes a healthy site look dead, so `fetchGsc` clamps the end date.
- **Don't poll ao.anamaya.com in a tight curl loop.** Vercel's bot protection
  starts serving a "Security Checkpoint" page to the client, which looks
  exactly like the app being broken. A browser passes the challenge; curl does
  not. Verify with single requests, spaced out.
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
- **Daily analytics rollups are not being written yet.** `site_metrics_daily`
  exists and is indexed, but nothing populates it; the dashboard calls Google
  live on each render. Fine at this traffic, and it keeps history once a sync
  job fills the table.
- **Phase 6 — attribution.** UTM capture on the website, a Sereenly/GHL webhook
  into `leads`, and booking-to-lead linking. Until this exists, every
  spend-derived metric is blended at best.
- **Goals are create/delete only** — no edit in place.
