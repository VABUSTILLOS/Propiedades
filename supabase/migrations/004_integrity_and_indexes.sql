-- =============================================================================
-- 004_integrity_and_indexes.sql — Data integrity hardening
-- PostgreSQL 16+ / pg_trgm
-- Adds: CHECK constraints, missing query indexes, flyer views counter,
--       universal updated_at maintenance, DB-side review rules,
--       trigram index for marketplace search.
-- =============================================================================

-- =============================================================================
-- 1. CHECK CONSTRAINTS
-- =============================================================================
-- Prices must never be negative (drafts keep price = 0 until published).
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS chk_properties_price_non_negative,
  ADD CONSTRAINT chk_properties_price_non_negative
    CHECK (price >= 0);

-- A booking slot must always be temporally sane.
ALTER TABLE public.availability_slots
  DROP CONSTRAINT IF EXISTS chk_slots_end_after_start,
  ADD CONSTRAINT chk_slots_end_after_start
    CHECK (end_time > start_time);

-- Bids are real money; a zero/negative offer is invalid.
ALTER TABLE public.bids
  DROP CONSTRAINT IF EXISTS chk_bids_offered_price_positive,
  ADD CONSTRAINT chk_bids_offered_price_positive
    CHECK (offered_price > 0);

-- The buyer CRM tier list is 1-based.
ALTER TABLE public.buyer_favorites
  DROP CONSTRAINT IF EXISTS chk_favorites_tier_rank_min,
  ADD CONSTRAINT chk_favorites_tier_rank_min
    CHECK (tier_rank >= 1);

-- =============================================================================
-- 2. MISSING QUERY INDEXES
-- =============================================================================
-- recompute_profile_rating() filters reviews by subject_id on every rating
-- change; without this it is a table scan.
CREATE INDEX IF NOT EXISTS idx_reviews_subject ON public.reviews(subject_id);

-- Flyer analytics are always read by flyer_id (owner dashboard + engagement).
CREATE INDEX IF NOT EXISTS idx_flyer_analytics_flyer ON public.flyer_analytics(flyer_id);

-- Threads and offers hang off transactions.
CREATE INDEX IF NOT EXISTS idx_transactions_property ON public.transactions(property_id);
CREATE INDEX IF NOT EXISTS idx_bids_transaction ON public.bids(transaction_id);

-- =============================================================================
-- 3. FLYER VIEWS COUNTER
-- =============================================================================
-- Every analytics row is one flyer view. SECURITY DEFINER: the insert comes
-- from an anonymous visitor, but bumping digital_flyers.views_count would be
-- blocked by RLS when run as the invoker.
CREATE OR REPLACE FUNCTION public.bump_flyer_views()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.digital_flyers
  SET views_count = views_count + 1
  WHERE id = NEW.flyer_id;
  RETURN NULL; -- AFTER trigger
END;
$$;

DROP TRIGGER IF EXISTS trg_flyer_analytics_bump_views ON public.flyer_analytics;
CREATE TRIGGER trg_flyer_analytics_bump_views
AFTER INSERT ON public.flyer_analytics
FOR EACH ROW EXECUTE FUNCTION public.bump_flyer_views();

-- =============================================================================
-- 4. UNIVERSAL updated_at MAINTENANCE
-- =============================================================================
-- The touch_updated_at() helper already exists (002). Extend it to every
-- mutable table. Tables that lacked the column get it with a NOW() backfill.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.availability_slots
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.digital_flyers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.flyer_analytics
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.buyer_favorites
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- The trigger helper is recreated here so 004 can run standalone.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'transactions', 'messages', 'availability_slots', 'reviews',
    'digital_flyers', 'flyer_analytics', 'buyer_favorites', 'bids',
    'market_benchmarks'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I;
       CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;

-- =============================================================================
-- 5. DB-SIDE REVIEW RULES
-- =============================================================================
-- Mirrors the app-level checks in src/modules/reviews/actions.ts so the DB
-- rejects invalid reviews even when written through the PostgREST API:
--   * the transaction must be closed,
--   * the author must be a transaction participant,
--   * no self-reviews,
--   * the subject must be the OTHER party.
CREATE OR REPLACE FUNCTION public.enforce_review_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  tx_state transaction_state;
  tx_buyer UUID;
  tx_owner UUID;
  author_is_buyer BOOLEAN;
  author_is_owner BOOLEAN;
BEGIN
  SELECT state, buyer_id, listing_owner_id
  INTO tx_state, tx_buyer, tx_owner
  FROM public.transactions
  WHERE id = NEW.transaction_id;

  IF tx_state IS NULL THEN
    RAISE EXCEPTION 'Review references an unknown transaction %', NEW.transaction_id
      USING ERRCODE = '23503'; -- foreign_key_violation
  END IF;

  IF tx_state <> 'closed' THEN
    RAISE EXCEPTION 'Reviews are only allowed on closed transactions (state = %)', tx_state
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  IF NEW.author_id = NEW.subject_id THEN
    RAISE EXCEPTION 'Users cannot review themselves'
      USING ERRCODE = '23514';
  END IF;

  author_is_buyer := (NEW.author_id = tx_buyer);
  author_is_owner := (NEW.author_id = tx_owner);
  IF NOT author_is_buyer AND NOT author_is_owner THEN
    RAISE EXCEPTION 'Only transaction participants can write reviews'
      USING ERRCODE = '23514';
  END IF;

  -- The subject must be the counterparty of the author.
  IF author_is_buyer AND NEW.subject_id <> tx_owner THEN
    RAISE EXCEPTION 'Review subject must be the other party of the transaction'
      USING ERRCODE = '23514';
  END IF;
  IF author_is_owner AND NEW.subject_id <> tx_buyer THEN
    RAISE EXCEPTION 'Review subject must be the other party of the transaction'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_enforce_rules ON public.reviews;
CREATE TRIGGER trg_reviews_enforce_rules
BEFORE INSERT OR UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.enforce_review_rules();

-- =============================================================================
-- 6. TRIGRAM SEARCH INDEX (marketplace + Cmd+K)
-- =============================================================================
-- Accelerates the .ilike() filters used by src/modules/search/queries.ts on
-- title / description / colonia / city. ILIKE '%…%' cannot use a plain btree
-- index; a GIN trigram index turns the pattern match into an index scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_properties_search_trgm
  ON public.properties
  USING GIN (
    (title || ' ' || COALESCE(description, '') || ' ' || colonia || ' ' || city)
    gin_trgm_ops
  );
