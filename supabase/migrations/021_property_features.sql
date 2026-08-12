-- =============================================================================
-- 021_property_features.sql — property feature columns for the 2026 buildout
--
-- Adds to properties:
--   1. estacionamientos INT   (parking spaces)
--   2. antiguedad INT         (property age in years)
--
-- Consistent with the existing recamaras / banos INT columns (migration 008).
-- The Vivanuncios scraper now persists recamaras, banos, estacionamientos and
-- antiguedad; existing rows are backfilled via scripts/backfill-property-features.mjs.
-- =============================================================================

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS estacionamientos INT,
    ADD COLUMN IF NOT EXISTS antiguedad INT;

COMMENT ON COLUMN properties.estacionamientos IS 'Number of parking spaces (from listing or detail page).';
COMMENT ON COLUMN properties.antiguedad IS 'Property age in years (from listing or detail page).';
