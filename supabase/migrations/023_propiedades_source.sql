-- =============================================================================
-- 023_propiedades_source.sql — Propiedades.com import attribution & dedup
--
-- Adds to properties:
--   1. listing_id_propiedades TEXT UNIQUE NULL — the portal listing ID (numeric
--      id at the end of the detail URL), used as the idempotency key for mass
--      imports (scripts/import-propiedades.mjs).
--
-- source_name already exists (added in migration 022) and is reused with the
-- value "propiedades" to distinguish these portal imports.
-- =============================================================================

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS listing_id_propiedades TEXT UNIQUE;

COMMENT ON COLUMN properties.listing_id_propiedades IS 'Propiedades.com listing ID (idempotency key for mass imports).';

-- Backfill source_name for existing portal rows so attribution is consistent.
UPDATE properties
SET source_name = 'propiedades'
WHERE source_name IS NULL
  AND source_url ILIKE '%propiedades.com/inmuebles/%';
