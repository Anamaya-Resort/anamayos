@AGENTS.md

# AO Platform — Claude Code Guide

## Project Overview
AO Platform is a multi-tenant-ready operations management system built for hospitality/retreat businesses.
It is designed to be **brand-agnostic** — all branding, copy, and business rules come from config/database, never hardcoded.

## Stack
- **Framework:** Next.js (App Router) with TypeScript strict mode
- **UI:** Tailwind CSS + shadcn/ui
- **Database:** Supabase (Postgres + Auth + RLS + Storage)
- **Hosting:** Vercel
- **i18n:** Custom dictionary-based system (`src/i18n/`)

## Architecture Rules

### File Organization
- `src/app/` — Next.js routes only (thin: fetch data, render module components)
- `src/modules/` — Domain modules (auth, bookings, leads, etc.) each own their types, components, and logic
- `src/components/ui/` — shadcn/ui primitives (do not edit directly)
- `src/components/layout/` — App shell (sidebar, topbar, etc.)
- `src/components/shared/` — Reusable components (badges, empty states, etc.)
- `src/lib/` — Utilities, Supabase clients, data access
- `src/config/` — App configuration, navigation
- `src/types/` — Shared TypeScript types
- `src/i18n/` — Translation dictionaries
- `supabase/migrations/` — SQL migrations (numbered, sequential)

### Key Principles
1. **No hardcoded branding.** Organization name, colors, logos, copy — all from config/DB.
2. **Server components by default.** Use `'use client'` only when needed (state, effects, event handlers).
3. **Small files.** Target <300 lines. Split if growing beyond 400.
4. **Strong typing.** No `any` except in rare escape-hatch situations (comment why).
5. **i18n everywhere.** Never use inline English strings for user-facing text. Use translation keys.
6. **Config-driven.** Feature flags, currencies, locales — all in `src/config/app.ts`.
7. **Security first.** Validate all input with Zod at boundaries. Trust RLS. Never expose service keys.
8. **Module boundaries.** Modules export through `index.ts` barrel files. Don't import module internals from outside.

### Supabase
- Browser client: `src/lib/supabase/client.ts`
- Server client: `src/lib/supabase/server.ts` (uses cookies for session)
- Service client: `src/lib/supabase/server.ts` `createServiceClient()` (admin only, server only)
- Middleware: `src/middleware.ts` handles session refresh and route protection
- RLS is enabled on ALL tables

### Route Structure
- `(auth)/*` — Public routes (login, signup, auth callback)
- `(dashboard)/*` — Protected routes (wrapped in AuthProvider + AppShell)

### Adding a New Module
1. Create `src/modules/<name>/` with types.ts, components, and index.ts
2. Add route pages in `src/app/(dashboard)/dashboard/<name>/`
3. Add nav item in `src/config/navigation.ts`
4. Add i18n keys in `src/i18n/en.ts` and `src/i18n/es.ts`
5. Add migration in `supabase/migrations/` if schema changes needed

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint

## Environment Variables
Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SECRET_KEY=
```

## Security Rules
- NEVER commit `.env.local` or any file containing secrets
- NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- NEVER disable RLS
- Validate all user input at API boundaries
- Use parameterized queries (Supabase client handles this)
