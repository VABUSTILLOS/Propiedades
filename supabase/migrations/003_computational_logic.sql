-- =============================================================================
-- 003_computational_logic.sql — State machine & financial formulas
-- PostgreSQL 16+
-- Adds: transaction state machine, rating aggregation, engagement score,
--       investor yield (cap rate / colonia discount) computations.
-- All logic lives in the database so integrity never depends on app code.
-- =============================================================================

-- =============================================================================
-- 1. SHARETRIBE TRANSACTION STATE MACHINE
-- =============================================================================
-- Validates that a transaction may only move through the legal state graph.
-- Terminal states (closed / canceled) cannot transition.
-- Participants (property/buyer/owner) are immutable after creation.
CREATE OR REPLACE FUNCTION public.validate_transaction_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  allowed_states transaction_state[];
BEGIN
  -- Immutability: the property and both parties are fixed at creation time.
  IF NEW.property_id IS DISTINCT FROM OLD.property_id
     OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
     OR NEW.listing_owner_id IS DISTINCT FROM OLD.listing_owner_id THEN
    RAISE EXCEPTION 'Transaction participants are immutable'
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  -- No-op updates (e.g. unrelated column) pass through untouched.
  IF NEW.state = OLD.state THEN
    RETURN NEW;
  END IF;

  allowed_states := CASE OLD.state
    WHEN 'inquired'     THEN ARRAY['tour_pending', 'offer_pending', 'canceled']::transaction_state[]
    WHEN 'tour_pending' THEN ARRAY['tour_confirmed', 'canceled']::transaction_state[]
    WHEN 'tour_confirmed' THEN ARRAY['offer_pending', 'closed', 'canceled']::transaction_state[]
    WHEN 'offer_pending' THEN ARRAY['offer_accepted', 'canceled']::transaction_state[]
    WHEN 'offer_accepted' THEN ARRAY['in_escrow', 'closed', 'canceled']::transaction_state[]
    WHEN 'in_escrow' THEN ARRAY['closed', 'canceled']::transaction_state[]
    ELSE ARRAY[]::transaction_state[] -- closed / canceled are terminal
  END;

  IF NOT (NEW.state = ANY(allowed_states)) THEN
    RAISE EXCEPTION 'Invalid transaction transition: % -> %', OLD.state, NEW.state
      USING ERRCODE = '23514';
  END IF;

  NEW.last_transition_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_state_machine ON public.transactions;
CREATE TRIGGER trg_transactions_state_machine
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.validate_transaction_transition();

-- =============================================================================
-- 2. SHARETRIBE RATING AGGREGATION ENGINE
-- =============================================================================
-- Recomputes a profile's rating_average / reviews_count from its review set.
-- Recomputed from AVG()/COUNT() (equivalent to the incremental formula
-- R_new = (R_old × N + R_submitted) / (N + 1)) so updates and deletes are
-- also correct, not just inserts.
-- SECURITY DEFINER: a reviewer (different user) triggers an update on the
-- subject profile, which RLS would otherwise block.
CREATE OR REPLACE FUNCTION public.recompute_profile_rating(subject_profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_rating NUMERIC(3, 2);
  total_count INT;
BEGIN
  SELECT AVG(rating)::NUMERIC(3, 2), COUNT(*)
  INTO avg_rating, total_count
  FROM public.reviews
  WHERE subject_id = subject_profile_id;

  UPDATE public.profiles
  SET rating_average = COALESCE(avg_rating, 0.00),
      reviews_count  = COALESCE(total_count, 0)
  WHERE id = subject_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_profile_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_profile_rating(OLD.subject_id);
  ELSE
    PERFORM public.recompute_profile_rating(NEW.subject_id);
  END IF;
  RETURN NULL; -- AFTER trigger
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_maintain_rating ON public.reviews;
CREATE TRIGGER trg_reviews_maintain_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.maintain_profile_rating();

-- =============================================================================
-- 3. FLYER.IO ENGAGEMENT SCORE
-- =============================================================================
-- S = MIN(100, (T_photos×0.2 + T_tour360×0.4 + T_piti×0.25 + T_map×0.15) × 1/3)
-- Weights express visitor intent per section; missing sections count as 0.
CREATE OR REPLACE FUNCTION public.compute_engagement_score(sections JSONB)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  photos   INT;
  tour_360 INT;
  piti     INT;
  map      INT;
  raw      NUMERIC;
BEGIN
  IF sections IS NULL THEN
    RETURN 0;
  END IF;

  photos   := COALESCE((sections->>'photos')::INT, 0);
  tour_360 := COALESCE((sections->>'tour_360')::INT, 0);
  piti     := COALESCE((sections->>'piti_calc')::INT, 0);
  map      := COALESCE((sections->>'map')::INT, 0);

  raw := (photos * 0.2 + tour_360 * 0.4 + piti * 0.25 + map * 0.15) / 3.0;

  RETURN LEAST(100, GREATEST(0, ROUND(raw)::INT));
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_flyer_engagement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.engagement_score := public.compute_engagement_score(NEW.sections_viewed);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flyer_engagement_score ON public.flyer_analytics;
CREATE TRIGGER trg_flyer_engagement_score
BEFORE INSERT OR UPDATE OF sections_viewed ON public.flyer_analytics
FOR EACH ROW EXECUTE FUNCTION public.maintain_flyer_engagement();

-- =============================================================================
-- 4. INVESTOR YIELD & SAVINGS PERCENTAGE
-- =============================================================================
-- Cap Rate: (estimated_monthly_rent × 12 / listing_price) × 100
CREATE OR REPLACE FUNCTION public.compute_cap_rate(price NUMERIC, monthly_rent NUMERIC)
RETURNS NUMERIC(5, 2)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF price IS NULL OR price <= 0 OR monthly_rent IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN ROUND(((monthly_rent * 12) / price) * 100, 2);
END;
$$;

-- Colonia Discount: how far below the colonia benchmark this property sits.
-- Δ = ((avg_price_m2_colonia − property_price_m2) / avg_price_m2_colonia) × 100
CREATE OR REPLACE FUNCTION public.compute_colonia_discount(target_property_id UUID)
RETURNS NUMERIC(5, 2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  prop    RECORD;
  bench   RECORD;
BEGIN
  SELECT colonia, city, precio_m2_const
  INTO prop
  FROM public.properties
  WHERE id = target_property_id;

  IF prop IS NULL OR prop.precio_m2_const IS NULL OR prop.precio_m2_const <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT avg_price_m2_const
  INTO bench
  FROM public.market_benchmarks
  WHERE city = prop.city AND colonia = prop.colonia
  LIMIT 1;

  IF bench IS NULL OR bench.avg_price_m2_const IS NULL OR bench.avg_price_m2_const <= 0 THEN
    RETURN NULL;
  END IF;

  RETURN ROUND(((bench.avg_price_m2_const - prop.precio_m2_const) / bench.avg_price_m2_const) * 100, 2);
END;
$$;

-- Convenience aggregate for the investor dashboard / AVM tables.
CREATE OR REPLACE FUNCTION public.compute_investor_metrics(target_property_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  prop RECORD;
  cap  NUMERIC(5, 2);
  disc NUMERIC(5, 2);
BEGIN
  SELECT price, estimated_monthly_rent
  INTO prop
  FROM public.properties
  WHERE id = target_property_id;

  cap  := public.compute_cap_rate(prop.price, prop.estimated_monthly_rent);
  disc := public.compute_colonia_discount(target_property_id);

  RETURN jsonb_build_object(
    'cap_rate',          cap,
    'colonia_discount',  disc
  );
END;
$$;

-- Auto-maintain stored financial columns whenever inputs change.
CREATE OR REPLACE FUNCTION public.maintain_property_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.price IS NOT NULL AND NEW.price > 0 AND NEW.estimated_monthly_rent IS NOT NULL THEN
    NEW.cap_rate_projected := public.compute_cap_rate(NEW.price, NEW.estimated_monthly_rent);
  ELSE
    NEW.cap_rate_projected := NULL;
  END IF;

  -- Discount vs. appraisal (savings vs. independent valuation).
  IF NEW.valor_avaluo IS NOT NULL AND NEW.valor_avaluo > 0 THEN
    NEW.porcentaje_descuento_avaluo := ROUND(((NEW.valor_avaluo - NEW.price) / NEW.valor_avaluo) * 100, 2);
  ELSE
    NEW.porcentaje_descuento_avaluo := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_financials ON public.properties;
CREATE TRIGGER trg_properties_financials
BEFORE INSERT OR UPDATE OF price, estimated_monthly_rent, valor_avaluo ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.maintain_property_financials();
