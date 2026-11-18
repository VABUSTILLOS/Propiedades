-- =============================================================================
-- 052_marketplace_saved_listings.sql — Guardados de Marketplace
--
-- Mirror of Victor's saved Facebook Marketplace listings (the ones the Muse
-- "Guardados de Marketplace" app shows), synced into the portal by
-- scripts/sync-marketplace-saved.mjs so they can be reviewed from
-- /admin/guardados and imported as draft properties with one click.
--
-- Photos are NOT hotlinked to Facebook: primary_photo_url / photo_urls point
-- to copies already uploaded to the public `property-images` Storage bucket
-- (migration 017), because Facebook CDN URLs are signed and expire.
--
-- Two different status fields, on purpose:
--   listing_status — the Marketplace ad state (Available / Sold / Rented).
--   status         — the portal workflow state: active (pending review),
--                    discarded (hidden by the admin, restorable) or imported
--                    (already turned into a properties draft).
--
-- Access: admin-only. The sync script writes with the service role (bypasses
-- RLS); the web UI reads/writes through the admin's session, so a single
-- FOR ALL policy gated on public.is_admin() (helper from 005, same pattern
-- as the admin moderation policy in 051) covers everything.
-- =============================================================================

-- 1. Table ----------------------------------------------------------------------
CREATE TABLE marketplace_saved_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Facebook Marketplace ad id (the numeric id in /marketplace/item/<id>).
    -- Idempotency key for the sync script's upserts.
    listing_id TEXT NOT NULL UNIQUE,

    title TEXT NOT NULL,
    price NUMERIC,
    currency TEXT NOT NULL DEFAULT 'MXN',

    -- Free-form location label as shown on Marketplace ("Chihuahua, Chih.")
    -- plus the parsed colonia / city when the extractor could split them.
    location TEXT,
    colonia TEXT,
    city TEXT,

    -- Coarse type detected by the extractor; drives the /admin/guardados
    -- type filter. Only 'propiedad' rows can be imported as properties.
    category TEXT NOT NULL DEFAULT 'otro'
        CHECK (category IN ('propiedad', 'auto', 'tecnologia', 'otro')),
    is_property BOOLEAN NOT NULL DEFAULT FALSE,

    condition TEXT,

    -- State of the ad on Marketplace itself.
    listing_status TEXT
        CHECK (listing_status IN ('Available', 'Sold', 'Rented')),

    -- Full ad description (not the AI-shortened one the URL importer makes).
    description TEXT,

    -- Structured data from the ad's real-estate details, when present.
    -- NUMERIC because Marketplace reports half bathrooms (2.5) and areas
    -- with decimals.
    bedrooms NUMERIC,
    bathrooms NUMERIC,
    area_m2 NUMERIC,

    source_url TEXT,

    -- Photos already copied to the property-images bucket.
    primary_photo_url TEXT,
    photo_urls TEXT[] NOT NULL DEFAULT '{}',

    -- Position in Victor's saved list (0 = first saved). Drives the
    -- "orden guardado" sort in /admin/guardados.
    saved_order INT,

    listing_created_at TIMESTAMPTZ,

    -- Portal workflow state (see header).
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'discarded', 'imported')),
    imported_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,

    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE marketplace_saved_listings IS
    'Saved Facebook Marketplace listings synced for review/import in /admin/guardados.';
COMMENT ON COLUMN marketplace_saved_listings.listing_id IS
    'Facebook Marketplace ad id; unique idempotency key for scripts/sync-marketplace-saved.mjs.';
COMMENT ON COLUMN marketplace_saved_listings.status IS
    'Portal workflow state: active | discarded | imported. The sync never overwrites it on existing rows.';
COMMENT ON COLUMN marketplace_saved_listings.listing_status IS
    'State of the ad on Marketplace: Available | Sold | Rented.';
COMMENT ON COLUMN marketplace_saved_listings.photo_urls IS
    'All ad photos, already uploaded to the property-images bucket (Facebook CDN URLs expire).';

-- 2. Indexes --------------------------------------------------------------------
CREATE INDEX idx_marketplace_saved_status
    ON marketplace_saved_listings(status);

CREATE INDEX idx_marketplace_saved_order
    ON marketplace_saved_listings(saved_order);

-- The import queue: properties still waiting to be imported.
CREATE INDEX idx_marketplace_saved_pending_properties
    ON marketplace_saved_listings(is_property, status)
    WHERE is_property AND status = 'active';

-- 3. RLS: admins only -------------------------------------------------------------
ALTER TABLE marketplace_saved_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage marketplace saved listings"
    ON marketplace_saved_listings FOR ALL
    USING (public.is_admin());
