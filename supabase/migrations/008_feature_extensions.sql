-- =============================================================================
-- 008_feature_extensions.sql — feature extensions for the 2026 buildout
--
-- Adds:
--   1. digital_flyers.white_label_source_flyer_id   (Stage 5 white-label sharing)
--   2. properties.recamaras / banos / amenidades / puntos_fuertes_bento
--      (Stage 2 multimodal ingestion)
--   3. property_local_surveys                       (Stage 4 "What Locals Say")
--   4. co_shopping_chat                             (Stage 6 co-shopping chat)
-- Includes RLS policies for the two new tables.
-- =============================================================================

-- 1. WHITE-LABEL SOURCE TRACKING -------------------------------------------------
ALTER TABLE digital_flyers
    ADD COLUMN IF NOT EXISTS white_label_source_flyer_id UUID
    REFERENCES digital_flyers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_digital_flyers_source
    ON digital_flyers(white_label_source_flyer_id);

-- 2. INGESTION FIELDS ON PROPERTIES ----------------------------------------------
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS recamaras INT,
    ADD COLUMN IF NOT EXISTS banos INT,
    ADD COLUMN IF NOT EXISTS amenidades JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS puntos_fuertes_bento JSONB DEFAULT '[]'::jsonb;

-- 3. LOCAL SURVEYS ("WHAT LOCALS SAY") ---------------------------------------------
-- Verified neighborhood surveys: residents rate safety, noise, walkability,
-- pet-friendliness and leave a short comment. "Verified" rows are written by
-- admin/agent via SECURITY DEFINER helper only (see below).
CREATE TABLE property_local_surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    safety_rating INT CHECK (safety_rating >= 1 AND safety_rating <= 5),
    noise_rating INT CHECK (noise_rating >= 1 AND noise_rating <= 5),
    walkability_rating INT CHECK (walkability_rating >= 1 AND walkability_rating <= 5),
    pet_friendly_rating INT CHECK (pet_friendly_rating >= 1 AND pet_friendly_rating <= 5),
    comment TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_local_surveys_property ON property_local_surveys(property_id);

ALTER TABLE property_local_surveys ENABLE ROW LEVEL SECURITY;

-- Anyone can read published surveys (public market transparency).
CREATE POLICY "Local surveys readable" ON property_local_surveys
    FOR SELECT USING (true);
-- Any signed-in user can add a survey (their own row).
CREATE POLICY "Users create local surveys" ON property_local_surveys
    FOR INSERT WITH CHECK (author_id = auth.uid());
-- Authors delete their own surveys.
CREATE POLICY "Authors delete own surveys" ON property_local_surveys
    FOR DELETE USING (author_id = auth.uid());
-- is_verified is immutable for authors (enforced by trigger below).
CREATE POLICY "Authors update own surveys" ON property_local_surveys
    FOR UPDATE USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- Nobody flips is_verified through the public API.
CREATE OR REPLACE FUNCTION public.protect_survey_verification()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
        RAISE EXCEPTION 'is_verified is managed by admins only';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_local_surveys_protect_verified
BEFORE UPDATE ON property_local_surveys
FOR EACH ROW EXECUTE FUNCTION public.protect_survey_verification();

-- 4. CO-SHOPPING CHAT --------------------------------------------------------------
-- Private conversation attached to a buyer_favorites row (shared shortlist).
CREATE TABLE co_shopping_chat (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    favorite_id UUID NOT NULL REFERENCES buyer_favorites(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_co_shopping_chat_favorite ON co_shopping_chat(favorite_id);

ALTER TABLE co_shopping_chat ENABLE ROW LEVEL SECURITY;

-- Only participants of the shared shortlist can read/write its chat.
-- (SECURITY DEFINER helper bypasses RLS on buyer_favorites — otherwise the
--  co-buyer's EXISTS subquery would be blocked by the favorites policy.)
CREATE OR REPLACE FUNCTION public.is_favorite_participant(target_favorite_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM buyer_favorites f
    WHERE f.id = target_favorite_id
      AND (
        f.user_id = auth.uid()
        OR f.co_buyer_votes->>'co_buyer_id' = auth.uid()::text
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_favorite_participant(UUID)
  TO anon, authenticated, service_role;

CREATE POLICY "Co-shopping participants access chat" ON co_shopping_chat
    FOR ALL USING (public.is_favorite_participant(co_shopping_chat.favorite_id));

-- 5. GRANT STANDARD PERMISSIONS ------------------------------------------------------
-- Supabase roles: anon/authenticated get table-level GRANTs; RLS still governs rows.
GRANT SELECT, INSERT, UPDATE, DELETE ON property_local_surveys TO authenticated;
GRANT SELECT ON property_local_surveys TO anon;
GRANT SELECT, INSERT ON co_shopping_chat TO authenticated;
