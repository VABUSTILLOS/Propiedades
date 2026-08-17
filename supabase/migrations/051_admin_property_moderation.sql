-- =============================================================================
-- 051_admin_property_moderation.sql — Admin (master user) property moderation
--
-- Adds the 'deleted' status (soft delete, recoverable from "Propiedades
-- borradas") and an RLS policy so admins can view/update/delete ANY property
-- (needed to moderate listings they don't own). Uses the existing
-- public.is_admin() SECURITY DEFINER helper (005) to avoid RLS recursion.
-- =============================================================================

-- 1. Soft-delete status. Archived/deleted stay hidden from public queries,
--    which all filter status = 'active'.
ALTER TYPE property_status ADD VALUE IF NOT EXISTS 'deleted';

-- 2. Admins manage all properties end to end.
CREATE POLICY "Admins manage all properties" ON properties FOR ALL
  USING (public.is_admin());
