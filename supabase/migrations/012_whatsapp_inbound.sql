-- =============================================================================
-- 012_whatsapp_inbound.sql — WhatsApp Business inbound webhook inbox
--
-- Stores messages that Meta's WhatsApp Cloud API delivers to the platform
-- webhook endpoint (/api/whatsapp/webhook). Supports the 24/7 booking bot
-- and the agent lead inbox.
--
-- Inserts come from the server-side webhook handler (service role, bypasses
-- RLS). Reads are restricted to authenticated agents/admins/owners.
-- =============================================================================

CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Meta's unique message id (wamid.HBgL...) used to dedupe retries.
    wa_message_id TEXT UNIQUE,
    -- Sender's WhatsApp id (wa_id, e.g. 5215512345678).
    wa_id TEXT NOT NULL,
    profile_name TEXT,
    phone_number TEXT,
    -- Message body for text messages.
    body TEXT,
    -- message type: text / image / interactive / ... (from payload `type`).
    message_type TEXT NOT NULL DEFAULT 'text',
    media_type TEXT,
    media_url TEXT,
    -- Raw webhook payload chunk for debugging / future parsers.
    metadata JSONB DEFAULT '{}'::jsonb,
    flyer_id UUID REFERENCES digital_flyers(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_messages_wa_id ON whatsapp_messages(wa_id);
CREATE INDEX idx_whatsapp_messages_flyer ON whatsapp_messages(flyer_id);
CREATE INDEX idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Reads: any authenticated agent/admin/owner_fsbo can browse the lead inbox.
CREATE POLICY "Agents and owners read whatsapp inbox" ON whatsapp_messages
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('agent', 'admin', 'owner_fsbo')
        )
    );

-- Mark-as-read / archive: same roles may update (but never rewrite sender fields).
CREATE POLICY "Agents and owners update read state" ON whatsapp_messages
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('agent', 'admin', 'owner_fsbo')
        )
    ) WITH CHECK (
        auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('agent', 'admin', 'owner_fsbo')
        )
    );

-- No public insert/delete: the webhook writes via service role only.
