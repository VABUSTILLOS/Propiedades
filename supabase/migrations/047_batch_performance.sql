-- =============================================================================
-- 047_batch_performance.sql — set-based queries that replace per-row RPC fan-out
--
-- Performance pass over the search/homepage hot paths:
--
-- 1. compute_colonia_discounts(p_ids): computes the colonia discount for a
--    whole set of property ids in a single pass (same math and null-guards as
--    the per-row compute_colonia_discount), so callers can avoid firing one
--    RPC per listing.
-- 2. list_active_cities(): distinct cities among active listings with their
--    listing counts — powers the search filter dropdown and the homepage
--    city/trust-strip stats without shipping every row to the client.
-- 3. list_active_colonias(p_type): distinct colonias among active listings,
--    optionally scoped to a deal type — powers the filter dropdown.
--
-- All functions are SECURITY INVOKER and STABLE: they run with the caller's
-- RLS policies and can be used inside PostgREST rpc() calls.
-- =============================================================================

-- =============================================================================
-- 1. Batch colonia discount
-- =============================================================================
-- Equivalent to running compute_colonia_discount once per id, but in a single
-- set-based pass. Only ids that resolve to a non-null discount are returned;
-- ids with no benchmark or a non-positive precio_m2_const are simply absent,
-- and callers default those to NULL (same semantics as the per-row function).
CREATE OR REPLACE FUNCTION public.compute_colonia_discounts(p_ids UUID[])
RETURNS TABLE(property_id UUID, discount_pct NUMERIC(5, 2))
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id AS property_id,
    ROUND(((b.avg_price_m2_const - p.precio_m2_const) / b.avg_price_m2_const) * 100, 2) AS discount_pct
  FROM public.properties p
  JOIN public.market_benchmarks b
    ON b.city = p.city AND b.colonia = p.colonia
  WHERE p.id = ANY(p_ids)
    AND p.precio_m2_const IS NOT NULL
    AND p.precio_m2_const > 0
    AND b.avg_price_m2_const IS NOT NULL
    AND b.avg_price_m2_const > 0;
$$;

-- =============================================================================
-- 2. Distinct active cities + counts
-- =============================================================================
-- Same predicate as the searchable dropdowns and homepage stats
-- (status = 'active' AND image_count > 1). The grouped counts let the
-- homepage derive its "activeCount" total and its per-city distribution from
-- one query instead of a full-table scan plus a head count.
CREATE OR REPLACE FUNCTION public.list_active_cities()
RETURNS TABLE(city TEXT, active_count BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.city,
    COUNT(*)::BIGINT AS active_count
  FROM public.properties p
  WHERE p.status = 'active'
    AND p.image_count > 1
    AND p.city IS NOT NULL
  GROUP BY p.city
  ORDER BY active_count DESC, p.city ASC;
$$;

-- =============================================================================
-- 3. Distinct active colonias
-- =============================================================================
CREATE OR REPLACE FUNCTION public.list_active_colonias(p_type TEXT DEFAULT NULL)
RETURNS TABLE(colonia TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT p.colonia
  FROM public.properties p
  WHERE p.status = 'active'
    AND p.image_count > 1
    AND p.colonia IS NOT NULL
    AND (p_type IS NULL OR p.type = p_type)
  ORDER BY p.colonia ASC;
$$;
