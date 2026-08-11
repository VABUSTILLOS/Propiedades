# Propiedades

Real estate SaaS & marketplace portal — two-sided marketplace (buyers/investors ↔ agents/FSBO owners) built with **Next.js App Router** + **Supabase** (PostgreSQL, RLS, Realtime), inspired by Sharetribe's marketplace UX.

## Stack

- **Framework**: Next.js 16 App Router (RSC, Server Actions, Route Handlers), React 19, TypeScript strict (zero `any`)
- **Styling/UI**: Tailwind CSS v4, shadcn/ui-style components, Framer Motion, Lucide icons, dnd-kit
- **Data**: `@tanstack/react-query` (optimistic), `useOptimistic`, Supabase typed clients (RLS-first, no ORM)
- **DB**: Supabase PostgreSQL — migrations in `supabase/migrations/` (RLS, triggers, PostGIS, pgvector)
- **Validation**: Zod (Zod-first contracts on every boundary)

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase provisioning (one-shot)

The app requires a Supabase project for all data pages (search, listings, auth, transactions).

**Reusing an existing project (no token, no new project needed — free plan allows only 2):** open your project at [supabase.com/dashboard](https://supabase.com/dashboard), then:

1. **Settings → Database → Connection string** — copy the pooler **URI** (it includes the password). Apply all migrations:
   ```bash
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
     node scripts/apply-migrations.mjs
   ```
   The runner applies `supabase/migrations/*.sql` in order, each in its own transaction. (Fallback: paste each file into the dashboard SQL Editor in order — 001 → 004.)
2. **Settings → API** — copy the **Project URL** and **anon key** → add to Vercel (see table below).
3. **Auth → URL Configuration** — set Site URL + Redirect URLs (see below).

**Creating a new project (requires an access token)** — only when you can create one. Create a token at https://supabase.com/dashboard/account/tokens, then:

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx bash scripts/setup-supabase.sh
```

The script logs in, creates a project in `us-east-1` (nearest US region to Mexico; override with `REGION=...`, e.g. `sa-east-1` for São Paulo), links the repo, pushes all migrations (`001_init.sql` → `004_integrity_and_indexes.sql`), and prints the env vars to add to Vercel.

Manual equivalent:

```bash
npx -y supabase login --access-token sbp_xxx
npx -y supabase projects create propiedades-marketplace --region us-east-1
npx -y supabase link --project-ref <REF>
npx -y supabase db push --yes
```

### Vercel env vars

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | publishable anon key from project settings |
| `NEXT_PUBLIC_SITE_URL` | ✅ | production URL (tenant apex + password-reset redirect) |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | only used by `requireEnv("server")` (currently unused) |

### Supabase auth config

In the dashboard (`Auth → URL Configuration`):

- **Site URL**: `https://vabustillos-scaling-potato.vercel.app`
- **Redirect URLs**: `https://vabustillos-scaling-potato.vercel.app/**`, `http://localhost:3000/**`

Known gap: password reset redirects to `/auth/update-password`, which has no route yet — password reset is a follow-up.

## Deploy on Vercel

```bash
npx -y vercel --prod --yes
```

Production: https://vabustillos-scaling-potato.vercel.app

## Project layout

```
src/
├── app/                        # App Router routes (thin)
├── modules/                    # feature modules: auth, profiles, listings, search,
│                               #   transactions, messaging, bookings, bids, reviews,
│                               #   flyers, favorites, market-data, ai, lib
└── supabase/
    ├── migrations/             # 001_init → 004_integrity_and_indexes
    └── functions/              # edge functions
```
