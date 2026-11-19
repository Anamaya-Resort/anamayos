# Social Content Performance (`/smm_tracking?view=content`)

Ten panels in deliberate scroll order, answering "what should we post next"
from the platform's own numbers. Built 2026-Nov-12 against generated sample
data, because no read token existed yet.

Module: `src/modules/social/`. Migration: `supabase/migrations/00067_social_analytics.sql`.
Seed script: `scripts/seed-social-sample.py`.

## 1. Read this first: the data is fake

> **Since 2026-Nov-19 there is a connector** — see §11. This section
> describes the state the page is in until a token is saved, which is
> still where it stands while the Meta sign-in is being sorted out.

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

### 1.1 Why there is still no token (2026-Nov-14)

An app now exists for this: **AnamayaOS Reporting**, App ID
`3756136297869867`, owned by the **LightningWorks** portfolio
`3180123972299244`. Its Unified Login configuration `1617678249404028` issues a
never-expiring system-user token and asks for `instagram_basic`,
`instagram_manage_messages` (Meta forces this one) and
`instagram_manage_insights`. @anamayaresort (IG `17841400689317448`) has
accepted the Instagram Tester invite. Redirect URL registered:
`https://ao.anamaya.com/api/meta/callback`; Meta refuses to register any
`facebook.com` address.

Token generation still fails at the last click with Meta's generic
"Could not connect AnamayaOS Reporting" page. The cause is **not** permissions
or configuration. @anamayaresort belongs to the business portfolio **Anamaya
Retreats** (`621147823232589`), and signing in through that Instagram account
produces a business user with read rights but no write rights there: the asset
picker populates correctly, then the share is refused. Meta states it plainly
at `business.facebook.com/latest/settings/business_users`, which redirects to
`out_of_scope_page_type=blocked_ig_user_in_mbs` with "You don't have access to
Settings. Send a request to people with full control of the Anamaya Retreats
business portfolio."

Neither of the other two routes helps. *API setup with Instagram login* is no
longer offered for new apps. *API setup with Facebook login* needs the
Instagram account linked to a Page the operator manages, and Geoff manages only
the LightningWorks Page.

**Who holds that portfolio.** @anamayaresort's Accounts Center
(`accountscenter.instagram.com/profiles/`) shows the Instagram account sits
alongside a personal Facebook profile named **"Anamaya Retreats"**,
`facebook.com/anamaya.retreats`, profile id `100001265774665`, contact
`enjoylife@anamaya.com`. That profile manages the Facebook Page "Anamaya Resort
and Retreat Center". It is an in-house Anamaya identity, not an agency account.
The portfolio carries its name, so it almost certainly holds full control,
though that has not been proven from outside.

**The unblocking step is administrative:** sign in as that "Anamaya Retreats"
Facebook profile and complete the grant, or have it add another Facebook
account as a portfolio admin. The connector work behind this is otherwise ready
to start.

**Which second factor (2026-Nov-14).** The login that stalls is the *Facebook*
profile, not Instagram. Meta's Accounts Center lists the two accounts as
separate two-factor enrolments, "Anamaya Retreats / Facebook" and
"anamayaresort / Instagram", so a working Instagram code is rejected here.
"Try another way" offers only two methods: an authentication app, or ID plus
video selfie. There is no SMS, no email and no approve-from-another-device
option. ID plus selfie is a poor bet because Meta matches the document against
the profile name and no person is named "Anamaya Retreats". Changing the
Facebook profile's 2FA method from the Instagram side is refused by Meta's
unfamiliar-device lock ("We'll allow you to make this change after you've used
this device for a while"), which lifts on its own after the browser has been
signed in for some days.

**Access request sent 2026-Nov-14.** The blocked Settings page carries a
"Send request" button; it was used. Meta confirms a request for Settings access
for Instagram profile @anamayaresort went to everyone with full control of the
Anamaya Retreats portfolio. If a second admin exists there, approving it
unblocks the token without the Facebook authenticator. If the "Anamaya
Retreats" profile is the only admin, the request cannot be answered and the
authenticator remains the only key. The notification is emailed to
`enjoylife@anamaya.com`, which Cloudflare forwards to
`anamayareservations@gmail.com`, so its arrival also serves as the first real
delivery test of that forward.

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

- **Pillar and campaign admin UI.** Both are database-only today.
- **Attribution**, which unlocks the bottom of panel 2.
- **Image-aware classification.** The keyword classifier in §11 reads
  captions and hashtags only. A post whose caption says nothing is left
  unclassified, which is honest but loses coverage.
- **TikTok and Facebook connectors.** The tables and the dashboard are
  already platform-agnostic; each is a new fetcher reusing §11's writer.

## 11. The Instagram connector (built 2026-Nov-19)

Code: `src/lib/meta/` (API) and `src/modules/social/ingest/` (sync).
Runs nightly from `/api/cron/social-sync` at 05:40 UTC, which is 23:40 the
same evening in Costa Rica, so it captures an almost complete local day.

### 11.1 The one thing that must not be got wrong

**The daily tables hold per-day increments, not running totals.**
`loadPosts` sums every daily row to produce a post's lifetime figure, and
`sumCounts` does the adding. Every platform API, Instagram included, reports
a post's total *as of now*. Writing that number straight into today's row
makes the dashboard count the same view once per day, forever, and the
error compounds silently.

`priorTotals` in `ingest/upsert.ts` reads every row dated before today,
and today's row is written as `lifetime - prior`, floored at zero. That is
also what makes a second run on the same day harmless: it recomputes the
same row instead of stacking on it.

`video_avg_watch_seconds` is the exception. It is an average, not a
counter, so it is stored as the level on each day and `sumCounts` averages
it back out. Instagram reports it in **milliseconds**; the connector
divides.

### 11.2 Getting a token

Two ways in, both landing in the same place: `marketing_secrets`,
`platform_key='instagram'`, `secret_key='access_token'`, with the account id
in `marketing_settings` under `instagram_account_id`.

1. **The OAuth round trip.** An admin opens `/api/meta/connect`, which
   redirects to Meta's dialog carrying login configuration
   `1617678249404028`. Meta returns to `/api/meta/callback` — an address
   registered on the app, so it cannot move without being re-registered
   there. The code is exchanged server side for a short-lived token and
   then again for a long-lived one; skipping that second exchange produces
   a connector that works all afternoon and is dead by morning. Needs
   `META_APP_SECRET` in the environment. The token never reaches the
   browser.
2. **Paste it.** The gear on `/smm_tracking` already has "Meta access
   token" and "Instagram Business Account ID" fields for the `instagram`
   platform. A token generated by hand in the app dashboard goes there.

`getMetaCredentials` reads them fresh on every run and never caches in
module scope, so a re-pasted token takes effect on the next sync rather
than after a redeploy. `META_ACCESS_TOKEN` and `META_IG_USER_ID` override
the stored values when set.

### 11.3 What one run does

Lists media newest-first back `windowDays` (45 by default), upserts the
posts, classifies them, snapshots each one's figures, then writes the
account's own day. It keeps to a four-minute budget and reports
`truncated: true` rather than being killed mid-write.

Instagram refuses a whole insights request when one metric in it does not
apply to that media type, and the valid list differs per type. The
connector asks for a superset, drops whatever is refused, remembers the
refusal for the rest of the run, and reports it as `droppedMetrics`. One
odd post can never fail a sync.

Metric translation, Meta's name on the left:
`saved` → `saves`, `profile_views` → `profile_visits`,
`profile_links_taps` → `link_clicks`, `ig_reels_avg_watch_time` (ms) →
`video_avg_watch_seconds`. Non-follower reach comes from the account's
`reach` broken down by `follow_type`; there is no per-post equivalent, so
post-level `non_follower_reach` stays zero. `follows_and_unfollows` is split
on its breakdown labels, treating anything reading as an unfollow as one,
because those labels have changed before.

### 11.4 Backfill, and what cannot be backfilled

`POST /api/admin/social/sync` with `{"windowDays": 365}` reaches old posts,
their captions, formats and pillars. **It cannot recover their history.**
Only today's figures can ever be recorded for a post published last year,
because that is all Instagram will say. Days before the connector ran are
gone permanently. This is why it runs nightly and why the job existing at
all was urgent.

### 11.5 How the sample data steps aside

Nothing is deleted. `getSocialDashboard` orders accounts by `is_sample`
ascending, so the real row wins the moment it exists and the banner
disappears on its own. The seeded account stays as a fallback and as a
reference for what a full year looks like.

### 11.6 The classifier

`ingest/classify.ts`, with its tests beside it in `classify.test.ts`.
Keywords only, weighted, scored so that **the strongest single term
decides rather than the most terms**: a teacher-training post always
contains more general yoga words than specific training ones, and scoring
on volume lets the broad pillar take the primary slot every time. The lead
term counts double and later ones a fraction of their weight.

Prose is matched on word boundaries, hashtags as substrings and at double
weight. The boundaries are not fussiness: plain `includes` found "rest"
inside "rainforest" and "om" inside "morning", and quietly tagged posts
with pillars nobody could see in them. Both cases are in the tests.

Below the confidence floor a post is left unclassified rather than guessed
at, because a wrong pillar poisons every comparison chart on the page.
Every row is written `source: 'auto'`; a post carrying any `manual` row is
never touched again.


## 12. The 2026-Nov-19 additions

Panels were renumbered to fit two new ones in. Hashtags became 7, so the
post table is now 8, best and worst 9, timing 10, audience growth 11, and
"Who follows us" is the new 12.

### 12.1 Panel 7 — hashtags

`hashtags.ts` builds it from posts already loaded; there is no extra
query. Tags were collected from day one and shown nowhere, which was the
cost of storing them with none of the answer.

Measured per person reached, like pillars, and for the same reason: a
tag you put on every post tops any total while saying nothing. Tags on
fewer than three posts are left out. One colour across all bars, because
these are a ranked list of one thing rather than a set of categories.

One trap worth knowing: the seeded sample rows store tags WITH the
leading hash while the connector strips it. `hashtagVM` normalises on
the way in, so whichever source is loaded the panel reads the same.

### 12.2 Panel 12 — audience

`audience.ts` plus `social_audience_demographics` (migration 00068).
Unlike every other panel this is a standing picture, not a flow, so it
reads the latest snapshot rather than the selected window. Shown as a
share rather than a headcount because Instagram caps each dimension at
its top entries and the counts do not sum to the follower total. It
withholds the whole thing below roughly a hundred followers, so an empty
panel is a normal state and says so.

### 12.3 Thumbnails

Instagram's image URLs are signed and expire within days, so storing the
one the API returns gives a table that looks right on sync day and is
full of broken frames a week later. `ingest/thumbnails.ts` fetches each
picture once, shrinks it to 320px webp and keeps it in a `social-thumbs`
bucket. It does a bounded batch per run and converges over several
nights rather than trying to do a back catalogue in one invocation.

### 12.4 Per-post pages

`/smm_tracking/post/<id>`, from `post-detail.ts`. The only view that
draws the daily snapshots instead of summing them, which is the one
question a ranked table cannot answer: did this post do its work in two
days, or is it still being found months later. Those look identical on
any lifetime total.

A page rather than a modal, deliberately: it is a thing you send
someone, and a modal has no address.

### 12.5 Custom ranges, and the trap underneath them

The four presets are still links. The custom pair cannot be, because two
dates are chosen before either is applied, so the picker became a client
component.

**That change silently broke every preset**, and the way it broke is
worth remembering. In the App Router, when a server component imports
from a `'use client'` module, *every* export becomes a client reference,
plain constants included. `RANGE_DAYS` arrived as a proxy, every lookup
came back undefined, and the `?? 365` fallback meant all four presets
quietly rendered a twelve-month window while still highlighting the
button that was pressed. Nothing threw. The presets looked like they
worked.

The constants now live in `ranges.ts` and only markup lives in
`range-picker.tsx`. **Do not move them back**, and apply the same rule
to any other shared constant a server component reads.

The same boundary caught the audience and post-detail types: a client
panel importing a type from the module that holds its server query
dragged `next/headers` into the browser bundle and failed the build.
Those shapes now live in `types.ts`, which imports nothing.

### 12.6 Export and the weekly email

`GET /api/admin/social/export` returns the window as CSV. Rates are
written as plain fractions, never preformatted percentages: a
spreadsheet can format a number and cannot un-format a string. Cells
beginning `=`, `+`, `-` or `@` are prefixed with an apostrophe, because
a caption starting with one of those is executed as a formula when the
file is opened. The file carries a BOM so Excel reads UTF-8 instead of
mangling every Spanish caption.

`/api/cron/social-report` emails last week's summary on Mondays at 7am
Costa Rica time, to whoever is listed under `report_recipients` for
instagram in the connections gear. Needs `BREVO_API_KEY`. With no key or
no recipients it returns 200 and says why, because both are the normal
state until someone asks for the report.

`src/modules/social/report.ts` is the one file in this module allowed to
contain hex values: email clients discard a stylesheet, and an email has
no access to the app's tokens.

### 12.7 Stories

`/api/cron/social-stories`, every four hours. Stories live 24 hours and
their insights die with them, so this is the one thing here that cannot
be caught up later. It reuses the same snapshot path as posts, so a
story is an ordinary row with `format: 'story'`.

### 12.8 Pillar keywords are data now

`pillar_keywords` (migration 00068), loaded by `ingest/rules.ts`. The
pillars were always rows while their keywords were TypeScript, so
changing what counts as "Wellness" meant a deploy. The list in
`classify.ts` is now only the fallback for an empty table, and the seed
the table was built from.

### 12.9 Chart colours 6-8

Re-toned from a bright blue, plum and teal into the deep earthy end of
the brand's own hues. Measured, not eyeballed: worst adjacent separation
went from 12.6 to 13.0 for normal vision and from 3.1 to 6.0 under
simulated protanopia and deuteranopia. The old blue-to-plum pair was the
weakest in the whole set. The expectation was that going on-brand would
cost legibility; it bought some.
