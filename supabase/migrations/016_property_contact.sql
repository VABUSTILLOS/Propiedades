-- =============================================================================
-- 016_property_contact.sql — Contact data for property listings
--
-- Adds seller/agency contact fields to properties so listings scraped from
-- Vivanuncios (and future sources) carry contact information alongside the
-- listing details. All columns are nullable so existing rows remain valid.
--
-- Field semantics:
--   contact_name  — Agency or broker display name (e.g. "GL Bienes Raíces").
--   contact_type  — "inmobiliaria" | "agencia" | "particular" (or null).
--   contact_phone — Visible phone number(s), whitespace-free 10-digit format
--                   ("6142523883") or space-separated multiples.
--   contact_whatsapp — Same as contact_phone when WhatsApp is reachable (most
--                      MX listings); null when unknown.
--   contact_email — Email when published; usually null for Vivanuncios tiles.
-- =============================================================================

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS contact_name TEXT;

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS contact_type TEXT
        CHECK (contact_type IS NULL OR contact_type IN ('inmobiliaria', 'agencia', 'particular'));

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS contact_phone TEXT;

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS contact_whatsapp TEXT;

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Fast lookup of listings that still lack contact data (for backfills).
CREATE INDEX IF NOT EXISTS idx_properties_contact_missing
    ON properties(id)
    WHERE contact_name IS NULL AND contact_phone IS NULL;
