-- =============================================================================
-- 009_tier_columns.sql — CRM Tier List columns for buyer_favorites
--
-- Adds a `tier_column` field so each favorite belongs to one of three
-- pipeline columns: #1 Top Choice (top_choice), Plan B (plan_b), Descartadas (discarded).
-- =============================================================================

ALTER TABLE buyer_favorites
    ADD COLUMN IF NOT EXISTS tier_column TEXT NOT NULL DEFAULT 'top_choice'
    CHECK (tier_column IN ('top_choice', 'plan_b', 'discarded'));

CREATE INDEX IF NOT EXISTS idx_buyer_favorites_tier_column
    ON buyer_favorites(user_id, tier_column, tier_rank);
