@AGENTS.md

# AO Platform — Claude Code Guide

## Project Overview
AO Platform is a multi-tenant-ready operations management system built for hospitality/retreat businesses.
Branding is applied via CSS variables and config — the codebase structure itself is reusable.

## Stack
- **Framework:** Next.js (App Router) with TypeScript strict mode
- **UI:** Tailwind CSS + shadcn/ui v4 (@base-ui/react)
- **Database:** Supabase (Postgres + RLS + Storage) — database only, NOT used for auth
- **Auth:** LightningWorks SSO (external portal)
- **Hosting:** Vercel
- **i18n:** Custom dictionary-based system (`src/i18n/`)

## Authentication
This app uses the **LightningWorks SSO** for authentication.
- SSO Portal: https://sso.lightningworks.io
- SSO Verify API: https://sso.lightningworks.io/api/verify
- App slug: `anamayos`
- Users do NOT create accounts within this app — all auth is handled externally.
- Do NOT build login/signup forms. Auth redirects to the SSO portal.

### Login Flow
1. User clicks "Sign in" → redirects to `https://sso.lightningworks.io/login?app=anamayos&redirect={CALLBACK_URL}`
2. SSO redirects back to `/auth/callback#access_token=JWT&refresh_token=TOKEN`
3. Client extracts `access_token` from URL hash (hash fragments are client-only)
4. Client POSTs to `/api/auth/verify` which calls SSO's `/api/verify`
5. On success, server sets `ao_session` cookie with user data
6. User is redirected to `/dashboard`

### Session Management
- Session stored in `ao_session` httpOnly cookie (7-day expiry)
- `src/lib/session.ts` — read/create sessions server-side
- `src/app/api/auth/session/route.ts` — GET endpoint for client-side hydration
- `src/app/api/auth/verify/route.ts` — POST verifies SSO token, upserts profile, sets cookie
- `src/app/api/auth/logout/route.ts` — POST clears the session cookie
- Sign out = clear local cookie only. No SSO logout needed.

### SSOUser Interface
```typescript
interface SSOUser {
  id: string;
  email: string;
  username: string;
  display_name: string;
  role: 'user' | 'admin' | 'superadmin';
  avatar_url: string | null;
  created_at: string;
  last_sign_in: string;
}
```

## Architecture Rules

### File Organization
- `src/app/` — Next.js routes only (thin: fetch data, render module components)
- `src/modules/` — Domain modules (auth, bookings, leads, etc.) each own their types, components, and logic
- `src/components/ui/` — shadcn/ui primitives (do not edit directly)
- `src/components/layout/` — App shell (sidebar, topbar, etc.)
- `src/components/shared/` — Reusable components (badges, empty states, etc.)
- `src/lib/` — Utilities, Supabase clients, session management
- `src/config/` — App configuration, navigation, SSO config
- `src/types/` — Shared TypeScript types (database.ts, sso.ts)
- `src/i18n/` — Translation dictionaries
- `supabase/migrations/` — SQL migrations (numbered, sequential)

### Key Principles
1. **Server components by default.** Use `'use client'` only when needed (state, effects, event handlers).
2. **Small files.** Target <300 lines. Split if growing beyond 400.
3. **Strong typing.** No `any` except in rare escape-hatch situations (comment why).
4. **i18n everywhere.** Never use inline English strings for user-facing text. Use translation keys.
5. **Config-driven.** Feature flags, currencies, locales — all in `src/config/app.ts`.
6. **Security first.** Validate all input with Zod at boundaries. Trust RLS. Never expose service keys.
7. **Module boundaries.** Modules export through `index.ts` barrel files. Don't import module internals from outside.
8. **shadcn/ui v4 uses @base-ui/react** — NOT radix. No `asChild` prop on triggers.

### Supabase (Database Only)
- Browser client: `src/lib/supabase/client.ts`
- Server client: `src/lib/supabase/server.ts`
- Service client: `src/lib/supabase/server.ts` `createServiceClient()` (admin only, server only)
- RLS is enabled on ALL tables
- Supabase is NOT used for authentication — only for database/storage

### Route Structure
- `(auth)/*` — Public routes (login page, SSO callback)
- `(dashboard)/*` — Protected routes (wrapped in AuthProvider + AppShell)

### Adding a New Module
1. Create `src/modules/<name>/` with types.ts, components, and index.ts
2. Add route pages in `src/app/(dashboard)/dashboard/<name>/`
3. Add nav item in `src/config/navigation.ts`
4. Add i18n keys in `src/i18n/en.ts` and `src/i18n/es.ts`
5. Add migration in `supabase/migrations/` if schema changes needed

## Design System
All design tokens are in `src/app/globals.css`. The system is multi-tenant-ready:
- **Brand tokens** (`--brand-*`) are the swappable layer per tenant
- **Semantic tokens** (`--primary`, `--border`, etc.) derive from brand tokens
- **Tailwind utilities** (`bg-brand-btn`, `text-brand-highlight`, etc.) are auto-generated
- To theme for a different company, add `[data-tenant="slug"]` CSS block overriding `--brand-*` vars

Current Anamaya brand values:
- `--brand-btn` (#A35B4E) — Terra cotta
- `--brand-highlight` (#A0BF52) — Green accent
- `--brand-divider` (#9CB5B1) — Turquoise borders
- `--brand-subtle` (#F5F7ED) — Off-white backgrounds
- `--radius: 5px`

Status colors: `--success`, `--warning`, `--info`, `--destructive` with foreground variants.
Full light + dark mode support. Responsive breakpoints via Tailwind (sm/md/lg/xl/2xl).

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint

## Environment Variables
Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=              # min 32 chars — used to encrypt/sign the session cookie
NEXT_PUBLIC_SSO_URL=https://sso.lightningworks.io
NEXT_PUBLIC_SSO_APP_SLUG=anamayos
```

## Security Rules
- NEVER commit `.env.local` or any file containing secrets
- NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- NEVER disable RLS
- NEVER decode JWT locally — always verify server-side via SSO `/api/verify`
- Validate all user input at API boundaries
- Use parameterized queries (Supabase client handles this)
