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
npm run setup:db             # apply migrations 001→010 (see "Supabase provisioning")
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase provisioning (one-shot)

**Quickest path — direct connection (recommended):**

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. **Settings → API** → copy **Project URL** + **anon key** → fill `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
3. **Settings → Database → Connection string** → copy the pooler **URI** (includes password) → add to `.env.local` as `SUPABASE_DB_URL`.
4. Run **`npm run setup:db`** — it applies all migrations `001_init.sql` → `010_semantic_search.sql` in order, each in its own transaction (partial failure rolls back only that file).

**Zero-tooling path:** paste the full contents of `supabase/migrations/_ALL_IN_ONE.sql` (regenerate with `npm run gen:migrations`) into the dashboard **SQL Editor** and run.

**CLI path:** `brew install supabase/tap/supabase`, `supabase login`, then with `SUPABASE_PROJECT_REF` set run `npm run setup:db` (runs `supabase link` + `supabase db push`).

**Creating a new project (automated, requires an access token + a free project slot)** — the free plan allows only 2 projects per account. If both slots are taken, create a second Supabase account (the limit is per-account) or delete an unused project. Generate a token at https://supabase.com/dashboard/account/tokens, then run:

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx npm run create:supabase
# or:  npm run create:supabase -- --token sbp_xxx
```

`scripts/provision-supabase.mjs` logs in, creates a project named `propiedades` in `us-east-1` (nearest US region to Mexico; override with `--region sa-east-1` for São Paulo), waits until it's active, fetches the anon + service_role keys, and writes `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_DB_URL` into `.env.local`. Then apply migrations with `npm run setup:db`. Flags: `--org-id`, `--project-ref` (reuse an existing project), `--name`, `--yes`.

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
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | optional | client-side Maps key (maps, Places, geocoding) |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | optional | Map ID enabling AdvancedMarkerElement (see below) |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | only used by `requireEnv("server")` (currently unused) |

### Google Maps Map ID (advanced markers)

The app loads the Maps JS API on the `beta` channel with the modern Marker library
(`libraries=maps,marker,places`). To enable **AdvancedMarkerElement**
(`<gmp-advanced-marker>` / PinElement pins):

1. In [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services**,
   enable the *Maps JavaScript API* and *Places API*.
2. Go to **Maps Management → Create Map ID**, pick a Map style (e.g. *JavaScript*),
   and copy the generated Map ID (e.g. `a1b2c3d4e5f6a1b2c3d4e5f6`).
3. Set `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` in `.env.local` (and Vercel).

When the Map ID is set, pins render via the modern marker API; without it the
module automatically falls back to the legacy `google.maps.Marker` API so the
app keeps working either way.

### Supabase auth config

In the dashboard (`Auth → URL Configuration`):

- **Site URL**: `https://vabustillos-scaling-potato.vercel.app`
- **Redirect URLs**: `https://vabustillos-scaling-potato.vercel.app/**`, `http://localhost:3000/**`

Demo credentials (seeded via SQL — verified working):

| Email | Password | Role |
|---|---|---|
| `demo@propiedades.mx` | `demo12345` | agent |
| `test2@propiedades.mx` | `test12345` | buyer |

> Note: if a user created directly via SQL ever returns `500 Database error querying schema` at sign-in, run
> `UPDATE auth.users SET email_change_token_current = '' WHERE email_change_token_current IS NULL;` — a NULL in
> that column breaks GoTrue's schema query.

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
    ├── migrations/             # 001_init → 010_semantic_search (+ _ALL_IN_ONE.sql generated)
    └── functions/              # edge functions (import-property-ai)
```
