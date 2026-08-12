-- =============================================================================
-- 020_whatsapp_chat_state.sql — per-conversation chat memory for the WhatsApp bot
--
-- The WhatsApp bot reuses the same chat pipeline as the web chatbot
-- (runChatSearch). To make follow-up refinements ("y más baratas") work over
-- WhatsApp it must remember the filters of the previous turn per sender.
--
-- This table is written/read ONLY by the server-side webhook via the service
-- role (RLS enabled with no policies = nothing else can touch it). Rows
-- expire after 7 days of inactivity.
-- =============================================================================

CREATE TABLE whatsapp_chat_state (
    wa_id TEXT PRIMARY KEY,
    -- Filters from the last chat turn (ChatFilters JSON). Empty = no context.
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_chat_state_updated ON whatsapp_chat_state(updated_at);

ALTER TABLE whatsapp_chat_state ENABLE ROW LEVEL SECURITY;

-- No policies: only the service-role client (webhook) may read/write.
-- Inactivity cleanup: `DELETE FROM whatsapp_chat_state
--   WHERE updated_at < now() - interval '7 days'` (run by the webhook).
