-- =============================================================================
-- 018_property_contact_methods.sql — Contact methods for property listings
--
-- Adds a list of contact channels available on the listing (e.g. which
-- buttons appear: "email_form", "whatsapp_button", "phone_button"). Filled
-- by the property_detail spider from the live rendered page.
-- =============================================================================

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS contact_methods_available TEXT[];

-- Fast lookup of listings that still lack contact data (for backfills).
CREATE INDEX IF NOT EXISTS idx_properties_contact_methods_missing
    ON properties(id)
    WHERE contact_methods_available IS NULL;
