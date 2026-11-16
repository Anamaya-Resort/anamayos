# Green Airways flight search (`/greenair`)

Status 2026-Nov-16: built, tested locally against Green Airways' live site.

## What it is
A public page at `https://ao.anamaya.com/greenair` where guests search Green
Airways (Costa Rica Green Airways) flights in our own design. It opens
prefilled with San José (SJO) to Cóbano (ACO), round trip, next Saturday to the
Saturday after, and searches straight away. The address keeps the search
(`?from=SJO&to=ACO&depart=2026-12-05&return=2026-12-12&adults=2`, add
`&lang=es` for Spanish), so links can be shared, and oN1X-2 can link to it.

Booking never happens on our side. Every "Book on Green Airways" button opens
the same search on Green Airways' own booking site, where the guest picks the
flight again and pays. We never take payment or passenger details.

## How it gets the data
Green Airways has no API. Their booking engine is TTinteractive "Zenith"
(`fo-latam.ttinteractive.com/Zenith/FrontOffice/CostaRicaGReenAirways`). We read
it the way their own search page does, with plain web requests (no browser):

1. `GET .../BookingEngine/SearchFlights?json=<search>` opens a search (the same
   link is our booking hand-off).
2. `POST .../FlexibleFlightStaticAjax/FlexibleFlightListLoadSelectedDays` with
   the page's own view model and anti-forgery token returns the flight list HTML.

Airports and routes are read from their home page once a day (falls back to a
built-in copy). About 3 to 5 seconds per fresh search.

- Code: `src/modules/greenair/` (`zenith.ts` fetches, `parse.ts` reads the HTML,
  `search.ts` caches and validates, `components/` is the page UI).
- API: `GET /api/public/greenair` (airports and routes) and
  `GET /api/public/greenair?from=SJO&to=ACO&depart=YYYY-MM-DD[&return=...]&adults=N`.
  Public with CORS, so anamaya.com and oN1X-2 can use it.
- Cache: 15 minutes per exact search (`unstable_cache`, shared across Vercel
  instances). Plus a brake of 40 searches per visitor per 10 minutes.

## Rules
- If their site ever shows its anti-fraud check (`<!--antifraud-->` in the flight
  list), we stop and show "couldn't reach Green Airways" with a link to their
  site. We never try to get around a bot check.
- If they redesign, parsing fails loudly ("page changed") rather than showing
  wrong flights. Fix `parse.ts`.
- Prices are per person, US dollars, as Green Airways shows them, and can change
  until booked. The page says so.

## Getting paid for bookings (not done)
Green Airways has no public affiliate program that we found. They do have a
"Partners & Travel Agencies" login. Once they give us a partner or tracking
code, set `GREENAIR_PARTNER_QUERY` on Vercel (e.g. `agency=anamaya`) and every
booking link carries it. Until then bookings through this page earn nothing.
