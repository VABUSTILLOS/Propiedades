-- 007: Seed demo users
--
-- Creates the accounts the scraper and demo flows depend on:
--   * demo@propiedades.mx (agent) — owns every imported/scraped listing.
--     scripts/scrape-vivanuncios.mjs hardcodes this id as OWNER_ID, and
--     properties.owner_id has a FK -> profiles(id), so it must exist.
--   * test2@propiedades.mx (buyer) — documented demo sign-in (README).
--
-- No properties, market benchmarks or flyers are seeded anymore: the site
-- only shows listings produced by the Vivanuncios scraper. Existing demo
-- rows are cleaned up by 014_remove_demo_data.sql.
--
-- Self-contained: creates the auth.users rows first (fixed UUIDs) so the
-- 002 signup trigger materializes the profiles before any FK insert.

-- 0. Demo users (auth.users -> profiles via 002 trigger) -----------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- GoTrue breaks with "Database error querying schema" (HTTP 500) when any of
-- these token columns are NULL, so default them to '' (README-documented fix).
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  email_change_token_current, confirmation_token, recovery_token,
  email_change_token_new, email_change, is_super_admin
) VALUES
(
  '00000000-0000-0000-0000-000000000000',
  '80a2428b-4d50-435d-8ce1-b1a9eba61176', -- demo agent / scraper owner
  'authenticated', 'authenticated', 'demo@propiedades.mx',
  crypt('demo12345', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}',
  '{"full_name":"Demo Agent","role":"agent"}', now(), now(),
  '', '', '', '', '', false
),
(
  '00000000-0000-0000-0000-000000000000',
  '5f0f1b1e-9c8d-4e6f-8a2b-3d4c5e6f7a8b', -- test buyer
  'authenticated', 'authenticated', 'test2@propiedades.mx',
  crypt('test12345', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}',
  '{"full_name":"Test Buyer","role":"buyer"}', now(), now(),
  '', '', '', '', '', false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) VALUES
(
  '80a2428b-4d50-435d-8ce1-b1a9eba61176',
  '80a2428b-4d50-435d-8ce1-b1a9eba61176',
  '{"sub":"80a2428b-4d50-435d-8ce1-b1a9eba61176","email":"demo@propiedades.mx","email_verified":true}',
  'email', now(), now(), now()
),
(
  '5f0f1b1e-9c8d-4e6f-8a2b-3d4c5e6f7a8b',
  '5f0f1b1e-9c8d-4e6f-8a2b-3d4c5e6f7a8b',
  '{"sub":"5f0f1b1e-9c8d-4e6f-8a2b-3d4c5e6f7a8b","email":"test2@propiedades.mx","email_verified":true}',
  'email', now(), now(), now()
)
ON CONFLICT (provider_id, provider) DO NOTHING;
