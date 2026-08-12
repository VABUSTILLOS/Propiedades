-- =============================================================================
-- 015_investment_categories.sql — Investor-mode differentiation
--
-- Differentiates the Invertir mode from the Comprar mode by tagging every
-- listing with a property category and a deal type. Comprar focuses on
-- person-to-person home sales (casa/departamento + venta_directa); Invertir
-- surfaces investment opportunities: bank foreclosures (remate_bancario),
-- fix-and-flip (flipping), contract transfers (traspaso), and commercial
-- assets (local, bodega, terreno).
--
-- All new columns have defaults or are nullable so existing rows remain valid.
-- =============================================================================

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'casa'
        CHECK (category IN ('casa', 'departamento', 'local', 'bodega', 'terreno'));

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS deal_type TEXT NOT NULL DEFAULT 'venta_directa'
        CHECK (deal_type IN ('venta_directa', 'remate_bancario', 'flipping', 'traspaso'));

-- Investment financial fields (nullable; set per deal_type).
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS costo_reparacion_estimado NUMERIC;      -- flipping: expected repair budget
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS valor_post_reparacion_estimado NUMERIC; -- flipping: after-repair value (ARV)
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS institucion_bancaria TEXT;              -- remate_bancario: issuing bank
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS fecha_remate DATE;                      -- remate_bancario: auction date
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS condiciones_traspaso TEXT;              -- traspaso: transfer terms

CREATE INDEX IF NOT EXISTS idx_properties_category_deal_type
    ON properties(category, deal_type, status);
