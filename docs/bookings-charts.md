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

## Occupancy chart

`src/modules/bookings/occupancy.ts` (query, server only) +
`occupancy-chart.tsx` (client, the three tabs).

Grouped bar chart: one slot per period on the x axis, one bar per year
side by side inside each slot, y axis the number of confirmed bookings in
house. Hand-rolled SVG, no charting dependency; colours come from the
existing `--chart-1..5` tokens in `src/app/globals.css`, newest year on
`--chart-1`. The legend swatch is a 20px square.

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
