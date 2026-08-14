-- =============================================================================
-- 046_deal_type_renta.sql — Add 'renta' to the deal_type CHECK constraint
--
-- The "Tipo de operación" (deal_type) field previously only covered sale
-- operations (venta directa, remate bancario, flipping, traspaso). This
-- migration widens the CHECK constraint so a listing can be tagged as a
-- rental operation ("Renta") too.
--
-- The constraint was created inline in migration 015, so Postgres auto-named
-- it `properties_deal_type_check`. We drop it (if present) and re-add it with
-- the new value. Existing rows remain valid.
-- =============================================================================

ALTER TABLE properties
    DROP CONSTRAINT IF EXISTS properties_deal_type_check;

ALTER TABLE properties
    ADD CONSTRAINT properties_deal_type_check
        CHECK (deal_type IN ('venta_directa', 'remate_bancario', 'flipping', 'traspaso', 'renta'));
