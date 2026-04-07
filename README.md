# AO Platform

A modern, multi-tenant-ready operations management platform for hospitality businesses. Built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run database migrations (via Supabase dashboard or CLI)
# See supabase/migrations/ for SQL files

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON` | Supabase anon/public key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) | Yes |

## Project Structure

```
src/
  app/              # Next.js App Router pages
    (auth)/         # Public auth routes (login, signup)
    (dashboard)/    # Protected dashboard routes
  components/
    ui/             # shadcn/ui primitives
    layout/         # App shell (sidebar, topbar)
    shared/         # Reusable components
  modules/
    auth/           # Authentication module
    bookings/       # Bookings module
  lib/
    supabase/       # Supabase client setup
  config/           # App configuration
  i18n/             # Internationalization
  types/            # Shared TypeScript types
supabase/
  migrations/       # SQL migration files
  seed.sql          # Development seed data
```

## Architecture

- **Brand-agnostic:** All organization-specific data comes from configuration/database
- **Server-first:** Server Components by default, client only when needed
- **Module-based:** Each domain (auth, bookings, etc.) is a self-contained module
- **Config-driven:** Feature flags, currencies, locales managed centrally
- **Secure:** RLS on all tables, input validation at boundaries, no leaked secrets
- **i18n-ready:** All user-facing text uses translation keys (English + Spanish)

## Deployment

Designed for Vercel deployment. Set environment variables in the Vercel dashboard.

## Tech Stack

- [Next.js](https://nextjs.org/) — React framework with App Router
- [TypeScript](https://www.typescriptlang.org/) — Strict mode
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS
- [shadcn/ui](https://ui.shadcn.com/) — UI component primitives
- [Supabase](https://supabase.com/) — Postgres, Auth, Storage, RLS
- [Zod](https://zod.dev/) — Schema validation
- [Lucide](https://lucide.dev/) — Icons
