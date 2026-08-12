-- =============================================================================
-- 022_vivanuncios_source.sql — Vivanuncios import attribution & dedup
--
-- Adds to properties:
--   1. listing_id_vivanuncios TEXT UNIQUE NULL — the portal listing ID, used
--      as the idempotency key for mass imports (scripts/import-vivanuncios.mjs).
--   2. source_name TEXT NULL — provenance label ("vivanuncios") so the catalog
--      can distinguish portal imports from wizard-created listings.
--
-- source_url already exists; the numeric listing ID extracted from it is what
-- makes re-imports safe across page/order changes on the portal.
-- =============================================================================

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS listing_id_vivanuncios TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS source_name TEXT;

COMMENT ON COLUMN properties.listing_id_vivanuncios IS 'Vivanuncios listing ID (idempotency key for mass imports).';
COMMENT ON COLUMN properties.source_name IS 'Provenance of the listing: "vivanuncios" for portal imports, NULL for wizard-created.';

-- Backfill source_name for existing portal rows so attribution is consistent.
UPDATE properties
SET source_name = 'vivanuncios'
WHERE source_name IS NULL
  AND source_url ILIKE '%vivanuncios.com.mx%';
