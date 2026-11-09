# Bookings charts

`/dashboard/bookings?tab=charts`

The Bookings page has two sections, as link tabs in
`src/modules/bookings/bookings-tabs.tsx`:

- **Bookings List** — the default, the existing table and filters.
- **Charts** — one panel per chart, stacked, so further charts drop in
  below without reflowing the first.

The tabs are links rather than client state, so each section is a real URL
and, more importantly, the list never pays for the charts query. The
occupancy query reads every booking and retreat ever recorded; running it
on the default tab would slow the page everyone uses most.

## The two charts, and why they disagree

They answer two different questions and are easy to confuse, which is why
the sales one is on top.

| Chart | Question | A next-year column |
|---|---|---|
| **Bookings received** | When did the sale happen? | Empty. No booking has been taken in a year that has not started. |
| **Bookings in house** | When are the guests on site? | Full. Those are bookings already taken for retreats that run then. |

Both are right. The first counts each booking once on the day it was
taken; the second counts it once per week its retreat runs.

## Colour palette

`--chart-1` to `--chart-5` in `src/app/globals.css`, light and dark
stepped separately. The previous set drew two of its five slots from the
same terra cotta, so in dark mode `--chart-4` was byte-identical to
`--chart-1` and two years were literally the same colour. The new set is
earthy gold, deep teal, blue violet, terra cotta, slate, validated for
colour-blind and normal-vision separation against both card surfaces.

Colour is assigned by the year itself, counted from the oldest year
present, not by its rank on screen. So 2024 is gold on both charts and
stays gold when a new year arrives, rather than every series being
repainted. Slot 5 is a neutral and needs re-validating the first time
five years are drawn at once.

## Bookings received chart

`src/modules/bookings/received.ts` + `bookings-bar-chart.tsx`.

Each confirmed booking counts **once**, on the day it was taken. A
teacher training is one booking here, not three: the count-per-week rule
belongs to the occupancy chart.

### Which date, and why not the payment table

It uses `bookings.created_at`, the moment the booking was taken, which
for a retreat is the moment the deposit is paid.

There is no `payments` table. Payments live in `transactions` with
`category` of `payment` or `other_payment` and the money in
`credit_amount`. Measured on live data that is the worse source for this
chart: payment rows exist for only **791 of 1,187** confirmed bookings
(66%), fewer than half carry a `booking_id` so the rest have to be
matched by person plus retreat, and the table holds payments dating back
to 2020, well before booking records start. Building the chart on it
would understate every month by a third, unevenly.

Where a clean payment row does exist the two agree: of 393 bookings with
a card or bank payment linked directly, **382 took their first payment on
the same day the booking was created**.

### Proof that `created_at` is not an import stamp

This matters because the same column on `retreats` *is* an import stamp,
which burned an earlier analysis.

`rg_id` is Retreat Guru's own sequential booking number, present on all
1,187 confirmed bookings. Sorted by `created_at`, `rg_id` goes backwards
**once in 1,186 steps**. An import stamp would have scrambled that order
completely. Only 3 bookings have a `created_at` later than their own
check-in.

### The one real caveat: Feb and Mar 2024

Retreat Guru's numbering starts at 1 in early 2024, so those two months
also hold bookings that already existed and were entered when it went
live. The fingerprint is lead time: Feb 2024 has a median of **8 days**
from booking to check-in with 18 of 62 inside a week, against 60 to 150
days in every later month. March 2024's 167 bookings are inflated the
same way.

The dates are genuine data-entry dates, so they are not removed, but
those two months are not comparable sales months and the chart footnote
says so. **April 2024 onward is comparable.**

### Verified figures as of 2026-Nov-09

Bookings received, 2024 / 2025 / 2026: Jan 1/44/21, Feb 62/30/27,
Mar 167/26/20, Apr 52/39/33, May 24/23/23, Jun 29/39/19, Jul 25/33/29,
Aug 33/35/23, Sep 34/26/28, Oct 53/32/28, Nov 28/38/2, Dec 32/29/0.
Totals 540 / 394 / 253, which sums to 1,187, every confirmed booking.
Monthly and weekly totals agree. Teacher training bookings taken:
19 / 22 / 28, totalling 69, which is exactly the count of multi-week
bookings the occupancy query finds independently.

## Occupancy chart

`src/modules/bookings/occupancy.ts` (query, server only) +
`bookings-bar-chart.tsx` (client, shared with the received chart). The
week and pagination helpers both queries use live in `chart-buckets.ts`.

Grouped bar chart: one slot per period on the x axis, one bar per year
side by side inside each slot, y axis the number of confirmed bookings in
house. Hand-rolled SVG, no charting dependency. The legend swatch is a
20px square.

Three views, one renderer, so they read identically:

| Tab | x axis | Shows |
|---|---|---|
| Monthly (default) | 12 months | All confirmed bookings |
| Weekly | 53 ISO weeks | All confirmed bookings |
| YTTs | 12 months | The 3 week teacher trainings alone |

All three come from one server pass and share one year list, so a year
keeps its colour when you switch, and switching is instant client state
with nothing to refetch.

### The counting rule

A booking counts once for every week its retreat runs, so a 3 week
teacher training adds 1 to each of 3 weeks while a standard 7 day retreat
adds 1 to a single week. The span is derived from the retreat's own
`start_date`/`end_date`, never from its name: measured on live data, 164
retreats are 7 days, 11 are 21 days, and those 11 are exactly the teacher
trainings, so the dates already encode the rule.

Verified: 1,155 confirmed bookings produce 1,293 booking-weeks, which
equals 1,155 + 2 x 69 bookings sitting on a 3 week retreat. The YTT view
sums to 207, which is 69 x 3.

### Verified figures as of 2026-Nov-09

Monthly, 2024 / 2025 / 2026 / 2027: Jan 3/35/34/9, Feb 37/36/42/14,
Mar 58/40/61/4, Apr 64/12/18/6, May 45/44/2/0, Jun 34/26/21/5,
Jul 24/49/10/2, Aug 40/45/17/1, Sep 4/14/26/0, Oct 21/8/57/0,
Nov 50/71/51/0, Dec 71/44/38/0. Totals 451 / 424 / 377 / 41.

Weekly yearly totals match monthly exactly (451 / 424 / 377 / 41), which
is the cross-check that the two bucketing paths agree. Busiest single week
26 / 24 / 29 / 9; busiest single month 71 / 71 / 61 / 14.

YTT booking-weeks by year: 54 / 69 / 81 / 3, and the trainings only ever
run May, Jun, Jul, Aug, Sep, Oct, Nov.

### Things this code already handles

- **Pagination is mandatory here.** The query spans all history, already
  over PostgREST's silent 1,000 row cap (1,333 bookings). Without the
  paging helper the earliest years undercount with no error at all. Note
  the marketing queries are *not* paginated; they are safe only because
  the longest range that UI offers is 12 months (447 rows).
- **Weekly buckets need two fixes that monthly does not.** Day-of-year
  buckets drift against the Saturday retreat start and grow phantom empty
  weeks, so `isoWeek()` is used instead. But an ISO year disagrees with
  the calendar year at the turn of January: ISO week 53 of 2026 contains
  2027-01-02, which filed the New Year retreat's 9 bookings under 2026 and
  understated the newest year, the one being watched for pace.
  `weekBucket()` pins a stray week to week 1 or 53 of its own calendar
  year. A calendar month comes straight off the date and needs neither.
- **No date range.** The page has no range picker on this chart on
  purpose. A seasonality view only reads with whole years side by side.
- **2024 is partial.** Booking records begin 2024-Jan-22, which is why
  January 2024 reads 3 rather than being empty. The footnote says so.
- **A dynamic i18n lookup broke on a nested key.** `booking-filters.tsx`
  built a key at runtime (`status_${status}`) and indexed the whole
  `bookings` namespace, which typechecked only while every key under it
  was a string. Adding the nested `occupancy` block broke it. It now reads
  through `unknown` with a `typeof` guard and falls back to the raw
  status.

Periods reading 0 are real: no retreat was running. Every plotted number
is also printed in the table beneath the chart, with a totals row, so
nothing depends on hovering. The weekly table scrolls (53 rows) with a
sticky header; the monthly tables do not need to.

Month names come from `Intl.DateTimeFormat` with the session locale rather
than the dictionary, because `TranslationKeys` is a deep *string* record
and rejects an array of month names.
