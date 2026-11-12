# Social Content Performance (`/smm_tracking?view=content`)

Ten panels in deliberate scroll order, answering "what should we post next"
from the platform's own numbers. Built 2026-Nov-12 against generated sample
data, because no read token existed yet.

Module: `src/modules/social/`. Migration: `supabase/migrations/00067_social_analytics.sql`.
Seed script: `scripts/seed-social-sample.py`.

## 1. Read this first: the data is fake

Everything on the page today is seeded test data. The dashboard shows a
dashed warning banner whenever the active account has `is_sample = true`,
which is checked in `getSocialDashboard` and surfaced through
`SocialDashboardData.isSample`. **Do not remove that banner** until a real
account exists. A realistic chart is exactly the kind of thing that gets
screenshotted into a meeting six months later.

The stored Instagram token (`marketing_secrets`, `platform_key='instagram'`,
`secret_key='capi_token'`) is a **Conversions API** token. Verified
2026-Nov-12 with `debug_token`: its only scope is `read_ads_dataset_quality`.
All five reads fail:

| Call | Result |
|---|---|
| IG account fields | 400, missing permissions |
| IG media list | 400, missing permissions |
| IG insights | 400, missing permissions |
| Ad account insights | 403, "owner has NOT granted ads_management or ads_read" |
| Facebook Page | 400, missing permission |

To go live, one new token on the same system user with `instagram_basic`,
`instagram_manage_insights`, `pages_read_engagement`, `pages_show_list`,
`ads_read`, `read_insights`, `business_management` — **and** the Instagram
account, the Page and the ad account assigned to that system user as assets.
The asset assignment is the step people skip; token scopes alone are not
enough, which is what the ad-account 403 above is actually saying.

## 2. Non-negotiables

- **Metrics are snapshotted daily, never stored as one lifetime total.**
  Every platform API returns a post's totals as of now. Without a daily row
  you can never tell a post that took 10,000 views in two days from one that
  took four months, and campaign windows cannot be sliced. The history
  cannot be reconstructed later.
- **Comparisons use the 7-day maturity window, not lifetime totals.**
  `MATURITY_DAYS` in `queries.ts`. Comparing a post from last year against
  one from Tuesday by lifetime totals measures age, not quality. Posts
  younger than the window are excluded and counted out loud.
- **Comparisons are rates, never totals.** Forty yoga posts beat four
  biohacking posts on any total. Every entry in `COMPARISON_METRIC_IDS` is a
  rate, and the post count is printed beside every bar.
- **No figure is hover-only.** Bars carry their own labels, heatmap cells
  print their value, comparison charts have an always-visible table beneath.
- **No colour-only encoding.** See §4.
- **No dual-axis charts.** Two measures of different scale get two charts.
- **Impressions do not exist.** Meta removed them in April 2025; `views`
  replaced them. There is deliberately no `impressions` metric.
- **A missing number is a dash plus the reason, never a zero.** The funnel's
  bottom three steps say what is missing. A zero would claim social produced
  no bookings, which we cannot currently say either way.

## 3. Panel order, and why

The order is the argument: what you see first should change your decisions
most. Panels are numbered on screen so one can be named without describing it.

| # | Panel | Question | Needs |
|---|---|---|---|
| 1 | Where we stand | Are we winning? | token |
| 2 | Where the funnel leaks | Which step loses people? | token (top), UTMs (bottom) |
| 3 | Which subject pulls hardest | Does biohacking beat yoga? | token |
| 4 | Which subjects are heating up | Is a pillar going stale? | token |
| 5 | Did the push work | Did the focus month pay? | token |
| 6 | What to make next | Which format for which subject? | token |
| 7 | Every post | The raw record | token |
| 8 | Best and worst | What to stop doing | token |
| 9 | When to post | Which day and hour? | token + ~2 months of posts |
| 10 | Audience growth | Are we earning followers? | token |

Phase 2 is UTM capture on anamaya.com plus lead-to-booking matching, which
lights up the bottom of panel 2. Phase 3 is paid, once `ads_read` is live.

## 4. Colour, and why eight slots cannot pass the validator

Pillars store a `color_slot` (1 to 8) which resolves to `var(--chart-N)`.
No hex value appears anywhere in `src/modules/social`.

Slots 6, 7 and 8 were added to `globals.css` for this module; slots 1 to 5
keep their existing brand values untouched. **Eight categorical colours
cannot be made colourblind-safe on top of the locked brand five** —
`--chart-5` is pure grey (zero chroma) and `--chart-3` is a very
low-chroma turquoise. Measured with the dataviz validator, the worst
adjacent separation sits in the 6-to-8 ΔE band, which is only legal with a
second encoding channel.

So every chart in this module carries that second channel:

- Pillar comparison: horizontal bars, each labelled with its own name and
  value. No legend to decode.
- Pillar trend: small multiples, one chart per pillar with its own heading.
- Heatmaps: sequential single hue, value printed in each cell.
- Funnel, sparklines: single colour.

**Do not add a legend-only chart to this module** without re-running
`validate_palette.js`.

## 5. Restyling, in order of reach

1. **Light / dark** — done. Every token resolves to a var that `globals.css`
   redefines under `.dark`.
2. **A white-label client** — add a `[data-tenant="slug"]` block overriding
   `--brand-*` and `--chart-1..8`. Every chart, tile, table and heatmap
   repaints. No code change.
3. **One pillar or campaign** — change its `color_slot` / `accent_slot` in
   the database. Data, not code.

`theme.ts` is the only file that names a token. `mix()` derives shades
through the card surface rather than toward white, so a dark theme fades to
dark instead of washing out.

## 6. Why `view-models.ts` exists

Six panels are client components, because each carries a metric switcher.
Passing the post array into all six made React serialise 335 posts into the
page six separate times: **the first working version was 1.2 MB**, the same
failure that made `/dashboard/bookings` take fifteen seconds.

So the server computes every metric variant once and sends the answers.
Switching metric became an index lookup, and the page dropped to 837 KB
uncompressed / **138 KB gzipped** with 178 table rows and 55 charts on
screen. The panels are now dumb renderers that will take data from any
platform or any other source.

## 7. Platform-agnostic by construction

Nothing in the schema or the charts says "Instagram". `platform` is a
column, metric names are the generic ones every network reports
(views / reach / saves / shares), and a new network is a new row plus a
connector. TikTok, YouTube, LinkedIn and Pinterest all fit as-is; where a
network uses a different word for the same thing, the connector translates
on the way in and nothing downstream knows.

`src/modules/social/charts/` has no social knowledge at all and is reusable
anywhere in the app.

## 8. Gotchas

- **Every query paginates explicitly.** PostgREST silently caps at 1,000
  rows with no error. A year of daily snapshots is already 8,981 rows.
  `allRows()` in `queries.ts` is the only way these tables are read.
- **The posting-time grid is bucketed in the account's timezone**, stored on
  `social_accounts.timezone`, not UTC and not a global setting. Costa Rica
  is UTC-6, so a 7am local post lands at 13:00 UTC and a UTC grid would
  confidently tell you to post in the afternoon.
- **`socialLabels()` returns plain data, never functions.** It is built on
  the server and handed to client components as a prop; React cannot
  serialise a function across that boundary and fails the entire render with
  "Functions cannot be passed directly to Client Components". The one helper
  (`tx`) is imported by panels, not carried on the object.
- **Post age is computed on the server** (`Post.ageDays`). `Date.now()`
  during render is impure, trips `react-hooks/purity`, and gives a different
  answer on the server than in the browser at a date boundary.
- **Account reach is not the sum of post reach.** The account edge
  deduplicates people across posts, so it is lower. Panels 1 and 2 read
  account rows for reach and views for that reason, and post rows for the
  engagement breakdown, which the account edge does not split per day.
- **A thin baseline is flagged, not hidden.** Campaign panel warns when
  fewer than 5 comparable posts sit before the window. The seeded June
  biohacking campaign has a 2-post May baseline and so shows the warning,
  which is the behaviour to keep: a one-post baseline produces a
  confident-looking percentage that is pure noise.

## 9. Measured figures from the sample year

Useful as a regression check after changing the aggregation. Save rate over
the 7-day maturity window, whole seeded year:

| Pillar | Posts | Save rate | Share rate | Engagement |
|---|---|---|---|---|
| Biohacking | 33 | 2.76% | 1.22% | 6.96% |
| Yoga Teacher Training | 55 | 1.52% | 0.79% | 4.55% |
| Wellness | 59 | 1.34% | 0.94% | 5.82% |
| Yoga | 101 | 1.08% | 0.88% | 5.54% |
| Ecolodge & Adventure | 76 | 0.87% | 1.61% | 5.21% |
| Unclassified | 11 | 0.74% | 0.82% | 4.33% |

The generator builds those relationships on purpose: educational subjects
save, pretty places get shared, yoga carries the volume. Account totals for
the year: 8.06M views, 3.25M reach, 57.9% non-follower, 85K profile visits,
8,216 to 13,248 followers.

## 10. Still to build

- **The classifier.** `post_pillars` carries `confidence` and
  `source ('auto' | 'manual')`, and the post table flags anything under 0.7
  as "needs review", but nothing writes those rows yet. Intended: Claude
  reads caption, hashtags and image, assigns a primary plus secondaries;
  manual overrides always win and are never overwritten by a later pass.
- **The connector.** Writes `social_posts` plus one
  `social_post_metrics_daily` row per post per day, and one
  `social_account_metrics_daily` row per day. Must run daily or the history
  is lost, which cannot be recovered.
- **Pillar and campaign admin UI.** Both are database-only today.
- **Attribution**, which unlocks the bottom of panel 2.
