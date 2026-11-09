# Navigation and the sidebar

## Why navigation used to feel broken

Three separate faults stacked up. Each one is small; together they made
the left menu look like it was ignoring clicks.

### 1. Several items highlighted at once

`sidebar.tsx` decided which item was current with
`pathname.startsWith(item.href)`, which ignores path segment boundaries.
`/dashboard/bookings` starts with the string `/dashboard/book`, so **Book
and Bookings both lit up**, and `/dashboard/booking-form` lit Book too.

The same bug cut the other way: nothing at all highlighted on
`/dashboard/galleries` or on any Experience sub-page, because those paths
are not under their parent item's href.

Now `matches()` compares against `href + '/'`, and a group counts as
current when it or any of its children matches. Checked over every nav
href and every sub-page: exactly one top-level item and exactly one child
highlight for every path. Before the fix, 6 paths were wrong.

### 2. Categories needed two clicks

An item with sub-pages rendered its row as a `<button>` whose only job
was to expand the group. It never navigated. So reaching People, Products,
Image Collection or Experience was always expand, then click a child.

The row is now a real `<Link>` with a separate chevron button beside it
for expanding. One click goes to the section; the group also auto-expands
on arrival but stays collapsed if you collapsed it by hand.

### 3. Every click waited on a full server render, silently

This is the big one, and it is the "insanely slow" part.

Every page under `(dashboard)` is a dynamic route, because each reads the
session cookie. Per the Next 16 docs
(`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`):

> **Dynamic Route**: prefetching is skipped, or the route is partially
> prefetched if `loading.tsx` is present.

There was no `loading.tsx` anywhere above the pages. So **nothing was
prefetched at all**, and a click sat there with no feedback until the
server had rendered the entire page. On a slow connection that reads as a
dead UI, which is exactly what invites a second click.

`src/app/(dashboard)/loading.tsx` fixes it at the root cause. It gives
Next a fallback to prefetch, which turns every sidebar click into an
immediate client-side transition: the shell and sidebar stay interactive
and the skeleton shows at once while the real page streams in behind it.

Do not delete that file. It looks cosmetic and is not.

## Other changes made at the same time

- **Pending spinners use `useLinkStatus`.** The old version tracked one
  clicked href in component state and cleared it when `pathname` changed,
  so clicking the page you were already on left a spinner turning
  forever. The hook reports each Link's own real pending state. It is
  always rendered and toggled by opacity, because a spinner that appears
  and disappears shifts the row it is in.
- **The whole row is the click target.** The styling classes used to sit
  on a `<span>` inside the `<Link>`, leaving the anchor's clickable area
  ambiguous. They are on the Link itself now.
- **The session is seeded from the server.** `AuthProvider` started at
  access level 0 and fetched `/api/auth/session` on mount, so the first
  paint showed almost no nav items and the real ones appeared a moment
  later, shifting whatever was under the cursor. The `(dashboard)` layout
  is a server component that has already read and verified the same
  cookie, so it now passes that data in as `initial`. Identical data
  (`/api/auth/session` is a one-line wrapper over the same `getSession()`),
  one fewer HTTP round trip per page load, and a correct first paint.
  The fetch is kept for the unseeded case.
- **A skeleton while access level is unknown.** If the provider is ever
  unseeded, the sidebar draws placeholder rows rather than a short wrong
  list that then grows.

## Separate issue: the connection, not the app

Measured 2026-Nov-09 from the office Mac. A request for `/favicon.ico`,
which returns 404 without running app code, took 5.6s. Breakdown: DNS
3ms, TCP connect 118ms, **TLS handshake 4.5s**. At the same time
`google.com/favicon.ico` took 7.8s and `anamaya.com` took 10.5s, while
plain HTTP to ao.anamaya.com answered in 0.30s and one repeat of the same
HTTPS request came back in 0.43s. Ping was 108ms with 0% loss.

So DNS lookups and TLS handshakes were intermittently stalling for
seconds on that connection, affecting Google and Cloudflare equally. That
is not something the app can fix, and it is worth re-measuring the same
way before chasing a server-side cause for a slow page.
