-- =============================================================================
-- 045_property_intake.sql — "Sube tu propiedad" hybrid intake flow
--
-- Extends `properties` so a listing can be born from the WhatsApp chatbot
-- (photos + free text) and completed later through the web wizard at
-- /publicar/[token]. The row is a real property from the start: the public
-- feed never sees it until status flips to 'active' (existing RLS policy
-- "Public can view active properties"), so no draft leaks.
--
-- Writes/reads for the wizard go through server-side API routes using the
-- service role; `intake_token` (UUID, 122 bits) acts as the capability that
-- authorizes a session. No new anon/authenticated policies are added.
-- =============================================================================

-- 1. Intake enums ---------------------------------------------------------------
CREATE TYPE intake_status AS ENUM (
    'procesando',           -- row created, AI extraction running
    'borrador_incompleto',  -- extraction done, waiting for wizard answers
    'activo'                -- wizard completed, published to the feed
);

CREATE TYPE intake_channel AS ENUM ('whatsapp', 'web');

-- 2. Intake columns on properties ------------------------------------------------
ALTER TABLE properties
    ADD COLUMN intake_status intake_status,
    ADD COLUMN intake_channel intake_channel,
    -- WhatsApp metadata of the sender who started the intake.
    ADD COLUMN wa_id TEXT,
    ADD COLUMN wa_profile_name TEXT,
    -- Raw inbound text kept for audit / future re-extraction.
    ADD COLUMN ai_raw_text TEXT,
    -- Validated DeepSeek extraction + derived data (opportunity score, etc).
    ADD COLUMN ai_extracted JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Canonical list of fields the wizard still must ask. Single source of
    -- truth that drives the dynamic slides.
    ADD COLUMN missing_fields TEXT[] NOT NULL DEFAULT '{}',
    -- Unguessable capability token for the /publicar/[token] wizard link.
    ADD COLUMN intake_token UUID UNIQUE DEFAULT gen_random_uuid(),
    ADD COLUMN intake_expires_at TIMESTAMPTZ;

-- WhatsApp senders have no account yet: allow ownerless intake drafts.
-- Existing policies compare owner_id = auth.uid(), which is false for NULL,
-- so ownerless rows stay invisible to everyone except the service role.
ALTER TABLE properties ALTER COLUMN owner_id DROP NOT NULL;

-- 3. Indexes ---------------------------------------------------------------------
CREATE INDEX idx_properties_intake_pending
    ON properties(intake_status)
    WHERE intake_status IN ('procesando', 'borrador_incompleto');

CREATE INDEX idx_properties_wa_id
    ON properties(wa_id)
    WHERE wa_id IS NOT NULL;

-- 4. Guardrails ------------------------------------------------------------------
-- Intake rows always carry a token + expiry; non-intake rows keep them NULL.
ALTER TABLE properties
    ADD CONSTRAINT properties_intake_token_required
    CHECK (
        (intake_status IS NULL AND intake_channel IS NULL)
        OR (intake_status IS NOT NULL AND intake_channel IS NOT NULL
            AND intake_token IS NOT NULL AND intake_expires_at IS NOT NULL)
    );

-- Default expiry for new intake rows: 7 days to complete the wizard.
CREATE OR REPLACE FUNCTION set_intake_expiry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.intake_status IS NOT NULL AND NEW.intake_expires_at IS NULL THEN
        NEW.intake_expires_at := NOW() + INTERVAL '7 days';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_properties_intake_expiry
    BEFORE INSERT ON properties
    FOR EACH ROW EXECUTE FUNCTION set_intake_expiry();
