-- ============================================================
-- _ALL_IN_ONE.sql — GENERATED FILE. Do not edit by hand.
-- Run `npm run gen:migrations` to regenerate after adding a migration.
-- Concatenation of every numbered migration in order, for one-shot
-- application via the Supabase SQL Editor (or the setup-db runner).
-- ============================================================

-- ============================================================
-- SOURCE: 001_init.sql
-- ============================================================
-- =============================================================================
-- 001_init.sql — Propiedades production schema
-- PostgreSQL 16+ / PostGIS 3.4+ / pgvector
-- Includes: extensions, enums, 10 tables, indexes, triggers, RLS policies.
-- =============================================================================

-- 1. EXTENSIONS & ENUMS -------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TYPE user_role AS ENUM ('buyer', 'investor', 'agent', 'owner_fsbo', 'admin');
CREATE TYPE listing_type AS ENUM ('sale', 'rent');
CREATE TYPE property_status AS ENUM ('draft', 'pending_approval', 'active', 'reserved', 'sold', 'archived');
CREATE TYPE transaction_state AS ENUM ('inquired', 'tour_pending', 'tour_confirmed', 'offer_pending', 'offer_accepted', 'in_escrow', 'closed', 'canceled');
CREATE TYPE bid_status AS ENUM ('pending', 'accepted', 'rejected', 'countered');
CREATE TYPE payment_method AS ENUM ('cash', 'infonavit', 'fonacot', 'bank_loan', 'mixed');

-- 2. PROFILES -----------------------------------------------------------------
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'buyer',
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    subdomain TEXT UNIQUE, -- Multi-tenant agencies (agencia.tuportal.com)
    branding_config JSONB DEFAULT '{"primary_color": "#0F172A", "logo_url": null, "company_name": "", "whatsapp_cta": ""}'::jsonb,
    preapproval_data JSONB DEFAULT '{"infonavit_nss": null, "max_credit": 0, "bank_preapproved": false, "bank_name": null}'::jsonb,
    rating_average NUMERIC(3, 2) DEFAULT 0.00,
    reviews_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. MARKET BENCHMARKS ---------------------------------------------------------
CREATE TABLE market_benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city TEXT NOT NULL,
    colonia TEXT NOT NULL,
    avg_price_m2_const NUMERIC(12, 2) NOT NULL,
    avg_price_m2_land NUMERIC(12, 2) NOT NULL,
    historical_growth_rate NUMERIC(5, 2) DEFAULT 0.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(city, colonia)
);

-- 4. PROPERTIES (with wizard draft support) -------------------------------------
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    type listing_type NOT NULL DEFAULT 'sale',
    status property_status NOT NULL DEFAULT 'draft',
    current_wizard_step INT DEFAULT 1, -- Sharetribe multi-step onboarding state
    price NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'MXN',

    -- Dimensions & auto-calculated columns
    terreno_m2 NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    construccion_m2 NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    precio_m2_const NUMERIC(12, 2) GENERATED ALWAYS AS (price / NULLIF(construccion_m2, 0)) STORED,
    precio_m2_terreno NUMERIC(12, 2) GENERATED ALWAYS AS (price / NULLIF(terreno_m2, 0)) STORED,

    -- Financial metrics & AVM
    valor_avaluo NUMERIC(14, 2),
    porcentaje_descuento_avaluo NUMERIC(5, 2),
    estimated_monthly_rent NUMERIC(12, 2),
    cap_rate_projected NUMERIC(5, 2),
    hoa_fee NUMERIC(10, 2) DEFAULT 0.00,
    predial_anual NUMERIC(10, 2) DEFAULT 0.00,
    price_history JSONB DEFAULT '[]'::jsonb,
    tax_history JSONB DEFAULT '[]'::jsonb,

    -- Location & PostGIS spatial data
    address TEXT NOT NULL DEFAULT '',
    colonia TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT '',
    zip_code TEXT,
    lat DOUBLE PRECISION NOT NULL DEFAULT 0.00,
    lng DOUBLE PRECISION NOT NULL DEFAULT 0.00,
    geog GEOGRAPHY(POINT, 4326),

    -- Neighborhood & environmental ratings
    neighborhood_vibe JSONB DEFAULT '{"safety_rating": 0, "pet_friendly_rating": 0, "walkability_score": 0}'::jsonb,
    noise_score INT DEFAULT 0,
    flood_risk_level TEXT DEFAULT 'low',
    nearby_schools JSONB DEFAULT '[]'::jsonb,

    -- MLS, syndication & flags
    is_top BOOLEAN DEFAULT false,
    property_score INT DEFAULT 0,
    is_mls BOOLEAN DEFAULT false,
    commission_split TEXT DEFAULT '50/50',
    private_notes TEXT,
    source_url TEXT,

    -- Media & vector embeddings
    images TEXT[] DEFAULT '{}',
    tour_360_url TEXT,
    video_url TEXT,
    embedding VECTOR(1536),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TRANSACTIONS & CONTEXTUAL MESSAGING ---------------------------------------
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    listing_owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    state transaction_state NOT NULL DEFAULT 'inquired',
    last_transition_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_system_event BOOLEAN DEFAULT false, -- Inline event cards (e.g. "Tour Requested")
    action_payload JSONB DEFAULT NULL, -- Interactive card data (bids, booking slots)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. AVAILABILITY SLOTS (tour booking engine) -----------------------------------
CREATE TABLE availability_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    agent_or_owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_booked BOOLEAN DEFAULT false,
    booked_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TWO-SIDED REVIEWS ----------------------------------------------------------
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(transaction_id, author_id)
);

-- 8. DIGITAL FLYERS & ANALYTICS ---------------------------------------------------
CREATE TABLE digital_flyers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    slug TEXT UNIQUE NOT NULL,
    custom_title TEXT,
    is_white_label BOOLEAN DEFAULT false,
    views_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE flyer_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flyer_id UUID NOT NULL REFERENCES digital_flyers(id) ON DELETE CASCADE,
    visitor_session_id TEXT NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    time_spent_seconds INT DEFAULT 0,
    sections_viewed JSONB DEFAULT '{"photos": 0, "tour_360": 0, "map": 0, "piti_calc": 0, "neighborhood": 0}'::jsonb,
    engagement_score INT DEFAULT 0,
    lead_email TEXT,
    lead_phone TEXT
);

-- 9. BUYER FAVORITES & TIER LIST ---------------------------------------------------
CREATE TABLE buyer_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    tier_rank INT NOT NULL DEFAULT 1,
    private_notes TEXT,
    user_photos TEXT[] DEFAULT '{}',
    co_buyer_votes JSONB DEFAULT '{"like": 0, "dislike": 0, "comments": []}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, property_id)
);

-- 10. BIDS -------------------------------------------------------------------------
CREATE TABLE bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    offered_price NUMERIC(14, 2) NOT NULL,
    payment_method payment_method NOT NULL DEFAULT 'cash',
    status bid_status NOT NULL DEFAULT 'pending',
    counter_offer_price NUMERIC(14, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES FOR MAXIMUM QUERY PERFORMANCE ---------------------------------------------
CREATE INDEX idx_properties_geog ON properties USING GIST (geog);
CREATE INDEX idx_properties_embedding ON properties USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_properties_colonia_city ON properties(city, colonia);
CREATE INDEX idx_transactions_buyer ON transactions(buyer_id);
CREATE INDEX idx_transactions_owner ON transactions(listing_owner_id);
CREATE INDEX idx_messages_transaction ON messages(transaction_id);
CREATE INDEX idx_availability_slots_property ON availability_slots(property_id);
CREATE INDEX idx_availability_slots_time ON availability_slots(start_time, end_time);
CREATE INDEX idx_favorites_user ON buyer_favorites(user_id);
CREATE INDEX idx_bids_buyer ON bids(buyer_id);
CREATE INDEX idx_reviews_transaction ON reviews(transaction_id);

-- AUTOMATIC POSTGIS TRIGGER ---------------------------------------------------------
CREATE OR REPLACE FUNCTION update_property_geog()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geog = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_property_geog
BEFORE INSERT OR UPDATE OF lat, lng ON properties
FOR EACH ROW EXECUTE FUNCTION update_property_geog();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_flyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE flyer_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_benchmarks ENABLE ROW LEVEL SECURITY;

-- Profiles ---------------------------------------------------------------------
CREATE POLICY "Public profiles are readable" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage all profiles" ON profiles FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Properties --------------------------------------------------------------------
-- Anyone can view active listings (public marketplace).
CREATE POLICY "Public can view active properties" ON properties FOR SELECT USING (status = 'active');
-- Agents can also view MLS-only listings.
CREATE POLICY "Agents can view MLS properties" ON properties FOR SELECT USING (
    is_mls = true AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'agent')
);
-- Owners (agents/FSBO) manage their own properties end to end (incl. drafts).
CREATE POLICY "Owners manage own properties" ON properties FOR ALL USING (owner_id = auth.uid());
-- Buyers can only read active properties (no draft visibility leak).
CREATE POLICY "Buyers read active only" ON properties FOR SELECT USING (status = 'active');

-- Transactions -------------------------------------------------------------------
-- Only the buyer and listing owner participate in a transaction.
CREATE POLICY "Transaction participants access" ON transactions FOR ALL USING (
    buyer_id = auth.uid() OR listing_owner_id = auth.uid()
);

-- Messages ------------------------------------------------------------------------
-- Only participants of the underlying transaction can read/write messages.
CREATE POLICY "Transaction message participants access" ON messages FOR ALL USING (
    EXISTS (
        SELECT 1 FROM transactions
        WHERE id = messages.transaction_id
        AND (buyer_id = auth.uid() OR listing_owner_id = auth.uid())
    )
);

-- Availability slots ---------------------------------------------------------------
-- Agents/owners manage slots for their own properties.
CREATE POLICY "Owners manage own slots" ON availability_slots FOR ALL USING (
    agent_or_owner_id = auth.uid()
);
-- Buyers can read slots for active properties (to book a tour).
CREATE POLICY "Buyers read slots on active properties" ON availability_slots FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM properties
        WHERE id = availability_slots.property_id AND status = 'active'
    )
);
-- A buyer books a slot (UPDATE limited to booked_by_user_id/self and is_booked).
CREATE POLICY "Buyers book slots" ON availability_slots FOR UPDATE USING (
    is_booked = false
    AND EXISTS (
        SELECT 1 FROM properties
        WHERE id = availability_slots.property_id AND status = 'active'
    )
) WITH CHECK (booked_by_user_id = auth.uid() AND is_booked = true);

-- Reviews ---------------------------------------------------------------------------
-- Double-blind: both sides of a transaction may write a review for the other party.
CREATE POLICY "Transaction parties write reviews" ON reviews FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM transactions
        WHERE id = reviews.transaction_id
        AND (buyer_id = auth.uid() OR listing_owner_id = auth.uid())
    )
);
-- Reviews are public once revealed (both submitted).
CREATE POLICY "Revealed reviews readable" ON reviews FOR SELECT USING (true);
-- Only the author can edit their own review.
CREATE POLICY "Authors update own reviews" ON reviews FOR UPDATE USING (author_id = auth.uid());
-- Only the author can delete their own review.
CREATE POLICY "Authors delete own reviews" ON reviews FOR DELETE USING (author_id = auth.uid());

-- Digital flyers ----------------------------------------------------------------------
-- Agents create and manage their flyers.
CREATE POLICY "Agents manage own flyers" ON digital_flyers FOR ALL USING (
    agent_id = auth.uid()
);
-- Public can view flyers by slug (anonymous share link).
CREATE POLICY "Public can view flyers" ON digital_flyers FOR SELECT USING (true);

-- Flyer analytics ---------------------------------------------------------------------
-- Insert is public (anonymous visitors), updates via beacon are app-side limited.
CREATE POLICY "Anyone can record flyer visit" ON flyer_analytics FOR INSERT WITH CHECK (true);
-- The owning agent can read analytics for their flyers.
CREATE POLICY "Agents read own flyer analytics" ON flyer_analytics FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM digital_flyers
        WHERE id = flyer_analytics.flyer_id AND agent_id = auth.uid()
    )
);
-- Nobody can delete analytics rows through the public API.
CREATE POLICY "No public flyer analytics deletes" ON flyer_analytics FOR DELETE USING (false);

-- Buyer favorites -----------------------------------------------------------------------
-- Only the owning user can manage their favorites list.
CREATE POLICY "Users manage own favorites" ON buyer_favorites FOR ALL USING (user_id = auth.uid());

-- Bids ------------------------------------------------------------------------------------
-- Buyers create their own bids.
CREATE POLICY "Buyers create own bids" ON bids FOR INSERT WITH CHECK (buyer_id = auth.uid());
-- Sellers can read bids on their properties; buyers can read their own bids.
CREATE POLICY "Bids visible to participants" ON bids FOR SELECT USING (
    buyer_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM properties
        WHERE id = bids.property_id AND owner_id = auth.uid()
    )
);
-- Only the seller responds to a bid (accept/reject/counter).
CREATE POLICY "Sellers respond to bids" ON bids FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM properties
        WHERE id = bids.property_id AND owner_id = auth.uid()
    )
);
-- Buyers can withdraw (delete) their own pending bids.
CREATE POLICY "Buyers delete own pending bids" ON bids FOR DELETE USING (
    buyer_id = auth.uid() AND status = 'pending'
);

-- Market benchmarks -------------------------------------------------------------------------
-- Readable by everyone (public market data).
CREATE POLICY "Market benchmarks readable" ON market_benchmarks FOR SELECT USING (true);
-- Only admins can write market data.
CREATE POLICY "Admins manage market benchmarks" ON market_benchmarks FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);


-- ============================================================
-- SOURCE: 002_auth_triggers.sql
-- ============================================================
-- =============================================================================
-- 002_auth_triggers.sql — profile lifecycle automation
-- Creates a profile row whenever a user signs up and keeps timestamps fresh.
-- =============================================================================

-- Auto-create a profile on signup. Copies email + name from auth.users metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
    full_name text := coalesce(meta->>'full_name', meta->>'name', '');
    role_text text := coalesce(meta->>'role', 'buyer');
    valid_role user_role;
BEGIN
    BEGIN
        valid_role := role_text::user_role;
    EXCEPTION WHEN invalid_text_representation THEN
        valid_role := 'buyer';
    END;

    INSERT INTO public.profiles (id, role, full_name, email)
    VALUES (new.id, valid_role, full_name, coalesce(new.email, ''))
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Keep updated_at fresh on profiles and properties.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_properties_updated_at ON public.properties;
CREATE TRIGGER trg_properties_updated_at
BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ============================================================
-- SOURCE: 003_computational_logic.sql
-- ============================================================
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


-- ============================================================
-- SOURCE: 004_integrity_and_indexes.sql
-- ============================================================
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


-- ============================================================
-- SOURCE: 005_fix_rls_recursion.sql
-- ============================================================
-- 005: Fix RLS infinite recursion on profiles
--
-- The "Admins can manage all profiles" policy (001) self-references profiles:
--   USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
-- Every query on profiles (direct or via subqueries from properties/transactions/
-- messages/bids/market_benchmarks policies) re-evaluates this policy, which
-- re-queries profiles -> infinite recursion (SQLSTATE 42P17).
--
-- Fix: SECURITY DEFINER helper functions that bypass RLS, and rewrite the three
-- policies that inline "SELECT 1 FROM profiles" to use them.

-- 1. Helper functions (bypass RLS; safe: only read own role row, return bool).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_agent()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'agent'
  );
$$;

-- 2. Rewrite the admin policy on profiles (drop self-referencing version).
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
CREATE POLICY "Admins can manage all profiles" ON profiles FOR ALL
  USING (public.is_admin());

-- 3. Rewrite the agent policy on properties.
DROP POLICY IF EXISTS "Agents can view MLS properties" ON properties;
CREATE POLICY "Agents can view MLS properties" ON properties FOR SELECT
  USING (is_mls = true AND public.is_agent());

-- 4. Rewrite the admin policy on market_benchmarks.
DROP POLICY IF EXISTS "Admins manage market benchmarks" ON market_benchmarks;
CREATE POLICY "Admins manage market benchmarks" ON market_benchmarks FOR ALL
  USING (public.is_admin());

-- Grant usage on the helper functions to anon/authenticated so RLS checks work.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_agent() TO anon, authenticated, service_role;


-- ============================================================
-- SOURCE: 006_fix_cap_rate_rent.sql
-- ============================================================
-- 007: Fix cap-rate overflow for rental listings
--
-- compute_cap_rate returns NUMERIC(5,2) (max 999.99). For 'rent' listings the
-- price is a monthly figure, so (monthly_rent*12/price)*100 blows up (e.g. 1200)
-- and the BEFORE INSERT trigger fails with numeric field overflow (22003).
-- Cap rate is a purchase metric; only compute it for 'sale' listings.

CREATE OR REPLACE FUNCTION public.maintain_property_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Cap rate applies to purchases only; rents have no capital value ratio.
  IF NEW.type = 'sale' AND NEW.price IS NOT NULL AND NEW.price > 0 AND NEW.estimated_monthly_rent IS NOT NULL THEN
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


-- ============================================================
-- SOURCE: 007_seed_demo_data.sql
-- ============================================================
-- 007: Seed demo users
--
-- Creates the accounts the scraper and demo flows depend on:
--   * demo@propiedades.mx (agent) — owns every imported/scraped listing.
--     scripts/scrape-vivanuncios.mjs hardcodes this id as OWNER_ID, and
--     properties.owner_id has a FK -> profiles(id), so it must exist.
--   * test2@propiedades.mx (buyer) — documented demo sign-in (README).
--
-- No properties, market benchmarks or flyers are seeded anymore: the site
-- only shows listings produced by the Vivanuncios scraper. Existing demo
-- rows are cleaned up by 014_remove_demo_data.sql.
--
-- Self-contained: creates the auth.users rows first (fixed UUIDs) so the
-- 002 signup trigger materializes the profiles before any FK insert.

-- 0. Demo users (auth.users -> profiles via 002 trigger) -----------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- GoTrue breaks with "Database error querying schema" (HTTP 500) when any of
-- these token columns are NULL, so default them to '' (README-documented fix).
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  email_change_token_current, confirmation_token, recovery_token,
  email_change_token_new, email_change, is_super_admin
) VALUES
(
  '00000000-0000-0000-0000-000000000000',
  '80a2428b-4d50-435d-8ce1-b1a9eba61176', -- demo agent / scraper owner
  'authenticated', 'authenticated', 'demo@propiedades.mx',
  crypt('demo12345', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}',
  '{"full_name":"Demo Agent","role":"agent"}', now(), now(),
  '', '', '', '', '', false
),
(
  '00000000-0000-0000-0000-000000000000',
  '5f0f1b1e-9c8d-4e6f-8a2b-3d4c5e6f7a8b', -- test buyer
  'authenticated', 'authenticated', 'test2@propiedades.mx',
  crypt('test12345', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}',
  '{"full_name":"Test Buyer","role":"buyer"}', now(), now(),
  '', '', '', '', '', false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) VALUES
(
  '80a2428b-4d50-435d-8ce1-b1a9eba61176',
  '80a2428b-4d50-435d-8ce1-b1a9eba61176',
  '{"sub":"80a2428b-4d50-435d-8ce1-b1a9eba61176","email":"demo@propiedades.mx","email_verified":true}',
  'email', now(), now(), now()
),
(
  '5f0f1b1e-9c8d-4e6f-8a2b-3d4c5e6f7a8b',
  '5f0f1b1e-9c8d-4e6f-8a2b-3d4c5e6f7a8b',
  '{"sub":"5f0f1b1e-9c8d-4e6f-8a2b-3d4c5e6f7a8b","email":"test2@propiedades.mx","email_verified":true}',
  'email', now(), now(), now()
)
ON CONFLICT (provider_id, provider) DO NOTHING;


-- ============================================================
-- SOURCE: 008_feature_extensions.sql
-- ============================================================
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


-- ============================================================
-- SOURCE: 009_tier_columns.sql
-- ============================================================
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


-- ============================================================
-- SOURCE: 010_semantic_search.sql
-- ============================================================
-- 010: Semantic search — pgvector match function for embeddings-backed queries.
-- The `embedding` column and HNSW index already exist (001). This function is
-- the RPC the app calls for cosine-similarity search over active listings.

create or replace function public.match_properties(
  query_embedding vector(1536),
  match_count int default 24
) returns table (
  id uuid,
  similarity float
) language plpgsql security definer
set search_path = public
as $$
begin
  return query
  select p.id, 1 - (p.embedding <=> query_embedding) as similarity
  from public.properties p
  where p.status = 'active'
    and p.embedding is not null
  order by p.embedding <=> query_embedding
  limit match_count;
end;
$$;

revoke all on function public.match_properties(vector(1536), int) from public;
grant execute on function public.match_properties(vector(1536), int) to authenticated;
grant execute on function public.match_properties(vector(1536), int) to anon;


-- ============================================================
-- SOURCE: 012_whatsapp_inbound.sql
-- ============================================================
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


-- ============================================================
-- SOURCE: 013_favorite_lists.sql
-- ============================================================
-- =============================================================================
-- 013_favorite_lists.sql — Custom favorites lists (private collections)
--
-- Lets a user group their favorite properties into named lists
-- (e.g. "Casas en Cancún", "Departamentos < 3M"). Lists are private and
-- linked to favorites: each item references buyer_favorites.id, so adding a
-- property to a list also keeps it saved as a favorite.
-- =============================================================================

CREATE TABLE favorite_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A property (via its favorite row) can belong to many lists; a list can
-- hold many favorites. Deleting a list or a favorite cleans up its items.
CREATE TABLE favorite_list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    list_id UUID NOT NULL REFERENCES favorite_lists(id) ON DELETE CASCADE,
    favorite_id UUID NOT NULL REFERENCES buyer_favorites(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(list_id, favorite_id)
);

CREATE INDEX idx_favorite_lists_user ON favorite_lists(user_id);
CREATE INDEX idx_favorite_list_items_list ON favorite_list_items(list_id, position);
CREATE INDEX idx_favorite_list_items_favorite ON favorite_list_items(favorite_id);

-- Keep updated_at fresh on rename/edit.
CREATE OR REPLACE FUNCTION touch_favorite_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_touch_favorite_lists_updated_at
    BEFORE UPDATE ON favorite_lists
    FOR EACH ROW EXECUTE FUNCTION touch_favorite_lists_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE favorite_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_list_items ENABLE ROW LEVEL SECURITY;

-- Lists are private: only the owning user can read or manage them.
CREATE POLICY "Users manage own lists"
    ON favorite_lists FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Items are managed through their owning list.
CREATE POLICY "Users manage own list items"
    ON favorite_list_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM favorite_lists
            WHERE favorite_lists.id = favorite_list_items.list_id
              AND favorite_lists.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM favorite_lists
            WHERE favorite_lists.id = favorite_list_items.list_id
              AND favorite_lists.user_id = auth.uid()
        )
    );


-- ============================================================
-- SOURCE: 014_remove_demo_data.sql
-- ============================================================
-- 014: Remove demo seed data
--
-- 007 used to seed 5 fake CDMX listings (Roma Norte, Condesa, Polanco,
-- Coyoacán, Del Valle), market benchmarks and digital flyers so the
-- marketplace had content. The site now only shows listings produced by the
-- Vivanuncios scraper, so this migration deletes the remaining demo rows from
-- environments that already ran the old 007 seed. Idempotent: safe to re-run.
--
-- Order matters: digital_flyers (and flyer_analytics via FK CASCADE) must go
-- before properties. market_benchmarks rows have no dependents.

-- Demo flyers (flyer_analytics rows cascade via FK).
DELETE FROM digital_flyers
WHERE property_id IN (
  SELECT id FROM properties
  WHERE slug IN (
    'departamento-roma-norte-1',
    'casa-condesa-jardin',
    'penthouse-polanco-chapultepec',
    'departamento-coyoacan-1',
    'oficina-del-valle'
  )
);

-- Demo listings (no remaining references after flyers are removed).
DELETE FROM properties
WHERE slug IN (
  'departamento-roma-norte-1',
  'casa-condesa-jardin',
  'penthouse-polanco-chapultepec',
  'departamento-coyoacan-1',
  'oficina-del-valle'
);

-- Demo market benchmarks (CDMX) — not produced by the scraper.
DELETE FROM market_benchmarks WHERE city = 'Ciudad de México';


-- ============================================================
-- SOURCE: 015_investment_categories.sql
-- ============================================================
-- =============================================================================
-- 015_investment_categories.sql — Investor-mode differentiation
--
-- Differentiates the Invertir mode from the Comprar mode by tagging every
-- listing with a property category and a deal type. Comprar focuses on
-- person-to-person home sales (casa/departamento + venta_directa); Invertir
-- surfaces investment opportunities: bank foreclosures (remate_bancario),
-- fix-and-flip (flipping), contract transfers (traspaso), and commercial
-- assets (local, bodega, terreno).
--
-- All new columns have defaults or are nullable so existing rows remain valid.
-- =============================================================================

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'casa'
        CHECK (category IN ('casa', 'departamento', 'local', 'bodega', 'terreno'));

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS deal_type TEXT NOT NULL DEFAULT 'venta_directa'
        CHECK (deal_type IN ('venta_directa', 'remate_bancario', 'flipping', 'traspaso'));

-- Investment financial fields (nullable; set per deal_type).
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS costo_reparacion_estimado NUMERIC;      -- flipping: expected repair budget
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS valor_post_reparacion_estimado NUMERIC; -- flipping: after-repair value (ARV)
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS institucion_bancaria TEXT;              -- remate_bancario: issuing bank
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS fecha_remate DATE;                      -- remate_bancario: auction date
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS condiciones_traspaso TEXT;              -- traspaso: transfer terms

CREATE INDEX IF NOT EXISTS idx_properties_category_deal_type
    ON properties(category, deal_type, status);


