-- ============================================================
-- _ALL_IN_ONE.sql — GENERATED FILE. Do not edit by hand.
-- Run `npm run gen:migrations` to regenerate after adding a migration.
-- Concatenation of every numbered migration in order, for one-shot
-- application via the Supabase SQL Editor (or the setup-db runner).
--
-- IMPORTANT: For a FRESH database only. If your database already has
-- migrations applied (e.g. re-running this after a previous setup),
-- the script will fail with errors like "type "user_role" already
-- exists". In that case apply ONLY the newest migrations (files with
-- the highest number prefix), not this bundle.
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


-- ============================================================
-- SOURCE: 016_property_contact.sql
-- ============================================================
-- =============================================================================
-- 016_property_contact.sql — Contact data for property listings
--
-- Adds seller/agency contact fields to properties so listings scraped from
-- Vivanuncios (and future sources) carry contact information alongside the
-- listing details. All columns are nullable so existing rows remain valid.
--
-- Field semantics:
--   contact_name  — Agency or broker display name (e.g. "GL Bienes Raíces").
--   contact_type  — "inmobiliaria" | "agencia" | "particular" (or null).
--   contact_phone — Visible phone number(s), whitespace-free 10-digit format
--                   ("6142523883") or space-separated multiples.
--   contact_whatsapp — Same as contact_phone when WhatsApp is reachable (most
--                      MX listings); null when unknown.
--   contact_email — Email when published; usually null for Vivanuncios tiles.
-- =============================================================================

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS contact_name TEXT;

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS contact_type TEXT
        CHECK (contact_type IS NULL OR contact_type IN ('inmobiliaria', 'agencia', 'particular'));

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS contact_phone TEXT;

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS contact_whatsapp TEXT;

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Fast lookup of listings that still lack contact data (for backfills).
CREATE INDEX IF NOT EXISTS idx_properties_contact_missing
    ON properties(id)
    WHERE contact_name IS NULL AND contact_phone IS NULL;


-- ============================================================
-- SOURCE: 017_image_provenance.sql
-- ============================================================
-- =============================================================================
-- 017_image_provenance.sql — Photo provenance + local hosting support
--
-- Tracks where each listing photo was obtained from (provenance) so every
-- image on the site can be traced back to its source listing, and enables
-- hosting photos locally (Supabase Storage bucket) instead of hotlinking
-- to third-party CDNs.
--
--   image_sources — TEXT[] parallel to properties.images; entry [i] holds the
--                   original source URL of images[i]. Kept in the same order
--                   so provenance survives after images[] is swapped to
--                   local bucket URLs.
--   storage bucket property-images — public bucket for local copies of
--                   listing photos.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Provenance column
-- ---------------------------------------------------------------------------
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS image_sources TEXT[] DEFAULT '{}';

-- ---------------------------------------------------------------------------
-- 2. Public storage bucket for local photo copies
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'property-images',
    'property-images',
    TRUE,
    10485760, -- 10 MB per file
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access to listing photos (they are public listings anyway).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'property-images public read'
    ) THEN
        CREATE POLICY "property-images public read"
            ON storage.objects
            FOR SELECT
            USING (bucket_id = 'property-images');
    END IF;
END $$;


-- ============================================================
-- SOURCE: 018_property_contact_methods.sql
-- ============================================================
-- =============================================================================
-- 018_property_contact_methods.sql — Contact methods for property listings
--
-- Adds a list of contact channels available on the listing (e.g. which
-- buttons appear: "email_form", "whatsapp_button", "phone_button"). Filled
-- by the property_detail spider from the live rendered page.
-- =============================================================================

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS contact_methods_available TEXT[];

-- Fast lookup of listings that still lack contact data (for backfills).
CREATE INDEX IF NOT EXISTS idx_properties_contact_methods_missing
    ON properties(id)
    WHERE contact_methods_available IS NULL;


-- ============================================================
-- SOURCE: 019_gemini_embeddings.sql
-- ============================================================
-- =============================================================================
-- 019_gemini_embeddings.sql — switch embeddings to a free Gemini provider
--
-- The old pipeline embedded listings with OpenAI text-embedding-3-small
-- (VECTOR(1536)). To keep the platform on free models only, embeddings now
-- come from Google Gemini gemini-embedding-001 (768 dimensions, via
-- outputDimensionality) with a free Google AI Studio key. This migration:
--   1. Casts the existing column to vector(768).
--   2. Recreates the HNSW cosine index for the new dimensionality.
--   3. Rewrites match_properties to accept vector(768).
-- =============================================================================

-- 1) Drop the old HNSW index (built for 1536 dims) before changing the column
--    type so Postgres never has to rebuild it mid-migration.
DROP INDEX IF EXISTS idx_properties_embedding;

-- 2) Resize the column. Old OpenAI (1536-dim) vectors cannot be cast to
--    vector(768) and are semantically incompatible with Gemini embeddings
--    anyway, so they are reset to NULL and re-generated by
--    scripts/backfill-embeddings.mjs.
ALTER TABLE properties
  ALTER COLUMN embedding TYPE vector(768) USING NULL;

-- 3) Recreate the HNSW cosine index for the new dimensionality.
CREATE INDEX idx_properties_embedding
  ON properties USING hnsw (embedding vector_cosine_ops);

-- 4) Rewrite the semantic search RPC for 768-dim vectors.
DROP FUNCTION IF EXISTS public.match_properties(vector(1536), int);
DROP FUNCTION IF EXISTS public.match_properties(vector(768), int);

create or replace function public.match_properties(
  query_embedding vector(768),
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

revoke all on function public.match_properties(vector(768), int) from public;
grant execute on function public.match_properties(vector(768), int) to authenticated;
grant execute on function public.match_properties(vector(768), int) to anon;


-- ============================================================
-- SOURCE: 020_whatsapp_chat_state.sql
-- ============================================================
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


-- ============================================================
-- SOURCE: 021_property_features.sql
-- ============================================================
-- =============================================================================
-- 021_property_features.sql — property feature columns for the 2026 buildout
--
-- Adds to properties:
--   1. estacionamientos INT   (parking spaces)
--   2. antiguedad INT         (property age in years)
--
-- Consistent with the existing recamaras / banos INT columns (migration 008).
-- The Vivanuncios scraper now persists recamaras, banos, estacionamientos and
-- antiguedad; existing rows are backfilled via scripts/backfill-property-features.mjs.
-- =============================================================================

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS estacionamientos INT,
    ADD COLUMN IF NOT EXISTS antiguedad INT;

COMMENT ON COLUMN properties.estacionamientos IS 'Number of parking spaces (from listing or detail page).';
COMMENT ON COLUMN properties.antiguedad IS 'Property age in years (from listing or detail page).';


-- ============================================================
-- SOURCE: 022_vivanuncios_source.sql
-- ============================================================
-- =============================================================================
-- 022_vivanuncios_source.sql — Vivanuncios import attribution & dedup
--
-- Adds to properties:
--   1. listing_id_vivanuncios TEXT UNIQUE NULL — the portal listing ID, used
--      as the idempotency key for mass imports (scripts/import-vivanuncios.mjs).
--   2. source_name TEXT NULL — provenance label ("vivanuncios") so the catalog
--      can distinguish portal imports from wizard-created listings.
--
-- source_url already exists; the numeric listing ID extracted from it is what
-- makes re-imports safe across page/order changes on the portal.
-- =============================================================================

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS listing_id_vivanuncios TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS source_name TEXT;

COMMENT ON COLUMN properties.listing_id_vivanuncios IS 'Vivanuncios listing ID (idempotency key for mass imports).';
COMMENT ON COLUMN properties.source_name IS 'Provenance of the listing: "vivanuncios" for portal imports, NULL for wizard-created.';

-- Backfill source_name for existing portal rows so attribution is consistent.
UPDATE properties
SET source_name = 'vivanuncios'
WHERE source_name IS NULL
  AND source_url ILIKE '%vivanuncios.com.mx%';


-- ============================================================
-- SOURCE: 023_propiedades_source.sql
-- ============================================================
-- =============================================================================
-- 023_propiedades_source.sql — Propiedades.com import attribution & dedup
--
-- Adds to properties:
--   1. listing_id_propiedades TEXT UNIQUE NULL — the portal listing ID (numeric
--      id at the end of the detail URL), used as the idempotency key for mass
--      imports (scripts/import-propiedades.mjs).
--
-- source_name already exists (added in migration 022) and is reused with the
-- value "propiedades" to distinguish these portal imports.
-- =============================================================================

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS listing_id_propiedades TEXT UNIQUE;

COMMENT ON COLUMN properties.listing_id_propiedades IS 'Propiedades.com listing ID (idempotency key for mass imports).';

-- Backfill source_name for existing portal rows so attribution is consistent.
UPDATE properties
SET source_name = 'propiedades'
WHERE source_name IS NULL
  AND source_url ILIKE '%propiedades.com/inmuebles/%';


-- ============================================================
-- SOURCE: 024_market_benchmarks_chihuahua.sql
-- ============================================================
-- Market benchmarks for colonias in Chihuahua, sourced from propiedades.com
-- detail-page statistics (Wayback captures, latest date wins) and list-capture
-- fallbacks (avg $/m² from listings ≤ $3,000,000 MXN, same city+colonia).
--
-- avg_price_m2_const / avg_price_m2_land are stored as cents-per-m² numeric
-- values (PostgREST inserts real numbers; columns are NUMERIC).
INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  -- Real benchmarks from detail-page statistics
  ('Chihuahua', 'Monteverde',                                15396, 16825, 0),
  ('Chihuahua', 'Colinas del Valle',                         11147, 11466, 0),
  ('Chihuahua', 'Romanzza',                                   8457,  8034, 0),
  ('Chihuahua', 'Diamante Reliz',                            15540, 14886, 0),
  ('Chihuahua', 'La Haciendita',                             17771, 18996, 0),
  ('Chihuahua', 'Bosques del Valle',                         14405, 16133, 0),
  ('Chihuahua', 'Campo Bello',                                9837, 11528, 0),
  ('Chihuahua', 'Misión del Valle',                          14938, 13956, 0),
  ('Chihuahua', 'Lomas del Santuario II Etapa',              15037, 11696, 0),
  -- Fallback benchmarks from list captures (≤ $3M listings)
  ('Chihuahua', 'Ciudad Universitaria',                      NULL,   2667, 0),
  ('Chihuahua', 'Lomas Altas V',                              NULL,   7968, 0),
  ('Chihuahua', 'Arquitos',                                  31765,  NULL, 0),
  ('Chihuahua', 'Provincia de Santa Clara Etapa I a La XII', 19366,  NULL, 0),
  ('Chihuahua', 'Los Pinos',                                 14773,  NULL, 0),
  ('Chihuahua', 'Santa Rosa',                                21739,  NULL, 0),
  ('Chihuahua', 'Seratta 36',                                20896,  NULL, 0),
  ('Chihuahua', 'Bosques de San Pedro',                      15372,  NULL, 0),
  ('Chihuahua', 'Puente de Piedra',                          21831,  NULL, 0),
  ('Chihuahua', 'Mirador',                                   19226,  NULL, 0),
  ('Chihuahua', 'Junta de los Ríos y Etapas',                11583,  NULL, 0),
  -- Real benchmarks from detail-page statistics (Nov 2025 + Feb 2025 datasets)
  ('Chihuahua', 'Ankara',                                    17453, 17798, 0),
  ('Chihuahua', 'Cuauhtémoc',                                12248,  8729, 0),
  ('Chihuahua', 'Lomas Montecarlo',                          10197, 10452, 0),
  ('Chihuahua', 'Los Huertos',                               10350, 12161, 0),
  ('Chihuahua', 'Panamericana',                              11918,  8854, 0),
  ('Chihuahua', 'Paseos de Chihuahua',                        8680, 10797, 0),
  ('Chihuahua', 'Quintas Montecarlo',                         8175,  7766, 0),
  ('Chihuahua', 'Residencial El León',                        8751,  6837, 0),
  ('Chihuahua', 'Rincón del Lago',                            8449,  9182, 0),
  ('Chihuahua', 'Santo Niño',                                29061, 27446, 0),
  ('Chihuahua', 'Tracia',                                    19111, 18870, 0),
  -- Fallback benchmarks from list captures (n=1, circular — low confidence)
  ('Chihuahua', 'Campesina',                                 22936,  NULL, 0),
  ('Chihuahua', 'Cumbres Universidad',                       13750,  NULL, 0),
  ('Chihuahua', 'Molino de Agua',                            16480,  NULL, 0),
  -- Real benchmarks from detail-page statistics (dataset 29, Oct 2023 + Nov 2024 captures)
  ('Chihuahua', 'Castilla Reliz',                            19549, 15883, 0),
  ('Chihuahua', 'Chihuahua II',                              12443, 12052, 0),
  ('Chihuahua', 'Villas del Rey V',                           6717,  5162, 0),
  ('Chihuahua', 'Rinconada los Nogales',                      6728,  4878, 0),
  ('Chihuahua', 'Arboledas I',                                9582,  9837, 0),
  -- Fallback benchmark (n=1, circular — low confidence)
  ('Chihuahua', 'Diego Lucero',                               8065,  NULL, 0),
  -- Real benchmarks from detail-page statistics (dataset 30, 2023–2025 captures)
  ('Chihuahua', 'Los Naranjos',                               6493,  NULL, 0),
  ('Chihuahua', 'Rigoberto Quiroz',                           5038,  NULL, 0),
  ('Chihuahua', 'Rincón Colonial',                            7795,  NULL, 0),
  -- Real benchmarks from multi-sample list captures (dataset 30)
  ('Chihuahua', 'Chihuahua I',                               21388,  NULL, 0),
  ('Chihuahua', 'Fraccionamiento Provincia de Santa Clara',  19355,  NULL, 0),
  -- Fallback benchmarks from list captures (n=1, circular — low confidence)
  ('Chihuahua', 'Jardines del Sol',                          10433,  NULL, 0),
  ('Chihuahua', 'Rincón de Los Huertos',                      7770,  NULL, 0),
  ('Chihuahua', 'Rinconadas de la Sierra',                    6973,  NULL, 0),
  ('Chihuahua', '2 de Octubre y Ampliación',                  7800,  NULL, 0),
  ('Chihuahua', 'Tierra y Libertad',                         16667,  NULL, 0),
  ('Chihuahua', 'Miguel Hidalgo',                             9000,  NULL, 0),
  ('Chihuahua', 'Adelitas I',                                 8097,  NULL, 0),
  ('Chihuahua', 'Lomas Vallarta',                            12228,  NULL, 0),
  ('Chihuahua', 'Ática',                                     23984,  NULL, 0)
ON CONFLICT (city, colonia) DO NOTHING;


-- ============================================================
-- SOURCE: 025_mortgage_leads.sql
-- ============================================================
-- 25. MORTGAGE CALCULATOR LEADS -----------------------------------------------------
-- Leads captured by the mortgage simulator on property detail pages.
-- Stores the contact data plus the simulation metadata used for follow-up.

CREATE TABLE mortgage_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    property_title TEXT,
    property_price NUMERIC(14, 2),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    simulated_monthly_payment NUMERIC(12, 2),
    simulated_down_payment NUMERIC(14, 2),
    simulation JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mortgage_leads_property ON public.mortgage_leads(property_id);
CREATE INDEX IF NOT EXISTS idx_mortgage_leads_created ON public.mortgage_leads(created_at DESC);

ALTER TABLE mortgage_leads ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can submit a lead.
CREATE POLICY "Anyone can submit a mortgage lead" ON mortgage_leads
    FOR INSERT WITH CHECK (true);

-- No public read/update/delete: leads are only visible via service role
-- (admin dashboards / CRM exports run with elevated privileges).
CREATE POLICY "No public mortgage lead reads" ON mortgage_leads
    FOR SELECT USING (false);

CREATE POLICY "No public mortgage lead updates" ON mortgage_leads
    FOR UPDATE USING (false);

CREATE POLICY "No public mortgage lead deletes" ON mortgage_leads
    FOR DELETE USING (false);


-- ============================================================
-- SOURCE: 026_market_benchmarks_dataset31.sql
-- ============================================================
-- 26. MARKET BENCHMARKS — DATASET 31 (119 newly imported listings) -----------
-- Populates market_benchmarks for the 69 colonias of the dataset-31 import
-- (Chihuahua, venta ≤ $3,000,000 MXN) that lacked coverage, so the semáforo
-- RPC (compute_colonia_discount) can score every imported property.
--
-- Sources: no Wayback detail-page captures exist for these colonias (CDX
-- hunt returned 0 snapshots), so values are computed from captured list-card
-- price/m² samples (price ÷ size_m2), dedup'd per property.
--   multi    → avg of n≥2 samples (best available)
--   filtered → outlier-filtered or manually overridden to the plausible sample
--   circular → n=1 sample, the property's own price (low confidence; score 0%)

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Campanario', 2359, NULL, 0),
  ('Chihuahua', 'Quintas del Sol', 2183, NULL, 0),
  ('Chihuahua', 'Encordada de León', 6360, NULL, 0),
  ('Chihuahua', 'Hacienda Isabella', 7676, NULL, 0),
  ('Chihuahua', 'Hacienda del Moro', 6148, NULL, 0),
  ('Chihuahua', 'Las Fuentes', 5022, NULL, 0),
  ('Chihuahua', 'Las Fuentes II', 2792, NULL, 0),
  ('Chihuahua', 'Paseo de los Leones', 6306, NULL, 0),
  ('Chihuahua', 'Quintas Carolinas', 3262, NULL, 0),
  ('Chihuahua', 'Sector Bolívar', 2130, NULL, 0),
  ('Chihuahua', 'Villa Toscana', 2674, NULL, 0),
  ('Chihuahua', 'Labor de Terrazas', 30206, NULL, 0),
  ('Chihuahua', 'La Cañada', 3559, NULL, 0),
  ('Chihuahua', 'Las Granjas', 13650, NULL, 0),
  ('Chihuahua', 'Chihuahua Centro', 5459, NULL, 0),
  ('Chihuahua', 'Lomas Altas II', 4666, NULL, 0),
  ('Chihuahua', 'Lomas del Santuario', 1733, NULL, 0),
  ('Chihuahua', 'Nombre de Dios', 12267, NULL, 0),
  ('Chihuahua', 'Hacienda Santa Fe', 16071, NULL, 0),
  ('Chihuahua', 'Saucito', 14082, NULL, 0),
  ('Chihuahua', 'Cerrada Navarra', 2427, NULL, 0),
  ('Chihuahua', 'Montecarlo', 7291, NULL, 0),
  ('Chihuahua', 'Cumbres IV', 3293, NULL, 0),
  ('Chihuahua', 'Cumbres Universidad II', 5971, NULL, 0),
  ('Chihuahua', 'Lomas del Sol II', 5892, NULL, 0),
  ('Chihuahua', 'Club Campestre', 4911, NULL, 0),
  ('Chihuahua', 'Arcadas', 4808, NULL, 0),
  ('Chihuahua', 'Argeo', 2563, NULL, 0),
  ('Chihuahua', 'Avícola II', 1379, NULL, 0),
  ('Chihuahua', 'Campestre Residencial I', 14074, NULL, 0),
  ('Chihuahua', 'Campestre Residencial II', 2250, NULL, 0),
  ('Chihuahua', 'Chulavista I', 15179, NULL, 0),
  ('Chihuahua', 'De La Madre (10 de Mayo)', 11770, NULL, 0),
  ('Chihuahua', 'El Jardín', 2364, NULL, 0),
  ('Chihuahua', 'Fuentes del Santuario', 6316, NULL, 0),
  ('Chihuahua', 'Hacienda Victoria', 9828, NULL, 0),
  ('Chihuahua', 'Herradura Pdu', 5415, NULL, 0),
  ('Chihuahua', 'Jardines del Sacramento', 7431, NULL, 0),
  ('Chihuahua', 'La Ribereña', 9703, NULL, 0),
  ('Chihuahua', 'Lomas Altas I', 2381, NULL, 0),
  ('Chihuahua', 'Lomas Altas IV', 2031, NULL, 0),
  ('Chihuahua', 'Lomas La Salle II', 2429, NULL, 0),
  ('Chihuahua', 'Lomas Universidad I', 3274, NULL, 0),
  ('Chihuahua', 'Lomas del Valle I y II', 6066, NULL, 0),
  ('Chihuahua', 'Los Portales', 17398, NULL, 0),
  ('Chihuahua', 'Melchor Ocampo', 11624, NULL, 0),
  ('Chihuahua', 'Mision Universidad I', 4906, NULL, 0),
  ('Chihuahua', 'Monte Caleres', 2019, NULL, 0),
  ('Chihuahua', 'Monte Xenit', 4005, NULL, 0),
  ('Chihuahua', 'Nacional', 11268, NULL, 0),
  ('Chihuahua', 'Parque Industrial Impulso', 3647, NULL, 0),
  ('Chihuahua', 'Parque Industrial Supra', 6133, NULL, 0),
  ('Chihuahua', 'Paseo de las Moras', 5064, NULL, 0),
  ('Chihuahua', 'Pedregal del Real', 13750, NULL, 0),
  ('Chihuahua', 'Puente de Cantera', 10279, NULL, 0),
  ('Chihuahua', 'Puerta del Valle', 9655, NULL, 0),
  ('Chihuahua', 'Quintas del Sol II', 3542, NULL, 0),
  ('Chihuahua', 'Real Universidad', 4347, NULL, 0),
  ('Chihuahua', 'Residencial la Cantera', 2822, NULL, 0),
  ('Chihuahua', 'Rosario', 6853, NULL, 0),
  ('Chihuahua', 'San Felipe V', 2588, NULL, 0),
  ('Chihuahua', 'San Francisco I', 17384, NULL, 0),
  ('Chihuahua', 'San Jorge', 1588, NULL, 0),
  ('Chihuahua', 'Santa Rita', 4148, NULL, 0),
  ('Chihuahua', 'Valle Dorado', 5125, NULL, 0),
  ('Chihuahua', 'Valle del Angel', 7068, NULL, 0),
  ('Chihuahua', 'Virreyes I', 1132, NULL, 0),
  ('Chihuahua', 'Vistas Campestre', 1653, NULL, 0),
  ('Chihuahua', 'Álamos', 8765, NULL, 0)
ON CONFLICT (city, colonia) DO NOTHING;


-- ============================================================
-- SOURCE: 027_market_benchmarks_dataset32.sql
-- ============================================================
-- 27. MARKET BENCHMARKS — DATASET 32 (29 newly imported colonias) ----------
-- Populates market_benchmarks for 29 colonias of the dataset-32 import
-- (Chihuahua, venta ≤ $3,000,000 MXN) that lacked coverage, so the semáforo
-- RPC (compute_colonia_discount) can score every imported property.
--
-- Sources: no Wayback detail-page captures exist for these colonias, so
-- values are computed from captured list-card price/m² samples
-- (price ÷ size_m2), dedup'd per property. Over-$3M cross-listed samples
-- (vivanuncios) and killed listings (no image) are excluded.
--
-- Terreno-only colonias store the value in avg_price_m2_land (const=0);
-- Villa Juárez (mixed) gets both columns; all others use avg_price_m2_const.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Abraham González', 9235, 0, 0),
  ('Chihuahua', 'Arquitectos', 12586, 0, 0),
  ('Chihuahua', 'Bahías', 26906, 0, 0),
  ('Chihuahua', 'Catania Residencial', 9375, 0, 0),
  ('Chihuahua', 'Cerrada Castilla', 0, 7370, 0),
  ('Chihuahua', 'Cerro de La Cruz', 10000, 0, 0),
  ('Chihuahua', 'Dale', 7143, 0, 0),
  ('Chihuahua', 'Hacienda Camila', 19117, 0, 0),
  ('Chihuahua', 'Las Animas', 43137, 0, 0),
  ('Chihuahua', 'Leones Universidad', 0, 10553, 0),
  ('Chihuahua', 'Linss', 38622, 0, 0),
  ('Chihuahua', 'Los Claustros Universidad', 14813, 0, 0),
  ('Chihuahua', 'Los Nogales', 0, 344, 0),
  ('Chihuahua', 'Madera 65', 7073, 0, 0),
  ('Chihuahua', 'Obrera Vista Avalos', 0, 3143, 0),
  ('Chihuahua', 'Panorámico', 6563, 0, 0),
  ('Chihuahua', 'Parques de San Felipe', 32308, 0, 0),
  ('Chihuahua', 'Ramón Reyes', 9171, 0, 0),
  ('Chihuahua', 'Real de Minas', 13333, 0, 0),
  ('Chihuahua', 'Reforma', 0, 2771, 0),
  ('Chihuahua', 'Riberas del Sacramento', 0, 300, 0),
  ('Chihuahua', 'San Felipe II', 38462, 0, 0),
  ('Chihuahua', 'San Fernando', 16901, 0, 0),
  ('Chihuahua', 'Toribio Ortega', 7885, 0, 0),
  ('Chihuahua', 'Unidad Cuauhtémoc', 37302, 0, 0),
  ('Chihuahua', 'Villa Juárez', 8233, 6198, 0),
  ('Chihuahua', 'Zarco', 11364, 0, 0),
  ('Chihuahua', 'Zona Centro', 30140, 0, 0),
  ('Chihuahua', 'Zootecnia', 23333, 0, 0);


-- ============================================================
-- SOURCE: 028_market_benchmarks_dataset33.sql
-- ============================================================
-- 28. MARKET BENCHMARKS — DATASET 33 (28 newly imported colonias) ----------
-- Populates market_benchmarks for 28 colonias of the dataset-33 import
-- (Chihuahua, venta ≤ $3,000,000 MXN) that lacked coverage, so the semáforo
-- RPC (compute_colonia_discount) can score every imported property.
--
-- Sources: no Wayback detail-page captures exist for these colonias, so
-- values are computed from captured list-card price/m² samples
-- (price ÷ size_m2), dedup'd per property.
--
-- Terreno-only colonias store the value in avg_price_m2_land (const=0);
-- mixed colonias (Cordilleras, Francisco R Almada, Granjas del Valle,
-- Robinson) get both columns; all others use avg_price_m2_const.
--
-- Excluded (no size data in source cards): Las Canteras, Los Llanos, Obrera.
-- Those properties have precio_m2_const NULL so the RPC returns NULL for them
-- regardless; benchmarks are impossible to compute without m² samples.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Ampliación Américas', 40714, 0, 0),
  ('Chihuahua', 'Begonias', 13793, 0, 0),
  ('Chihuahua', 'Bellavista', 5679, 0, 0),
  ('Chihuahua', 'Caminos del Valle', 27174, 0, 0),
  ('Chihuahua', 'Centro SCT Chihuahua', 5926, 0, 0),
  ('Chihuahua', 'Cerro Prieto', 0, 1344, 0),
  ('Chihuahua', 'Cordilleras', 23722, 10596, 0),
  ('Chihuahua', 'Crucero', 5392, 0, 0),
  ('Chihuahua', 'Cumbres de Robinson', 7333, 0, 0),
  ('Chihuahua', 'Ejido Labor de Terrazas', 0, 1008, 0),
  ('Chihuahua', 'Francisco R Almada', 22500, 5750, 0),
  ('Chihuahua', 'Granjas del Valle', 1143, 1500, 0),
  ('Chihuahua', 'Jardines de Oriente', 11983, 0, 0),
  ('Chihuahua', 'Marielena Hernandez', 10000, 0, 0),
  ('Chihuahua', 'Pacifico', 7805, 0, 0),
  ('Chihuahua', 'Parque Industrial Intermex Aeropuerto', 0, 467, 0),
  ('Chihuahua', 'Poblado La Haciendita', 0, 425, 0),
  ('Chihuahua', 'Poblado Labor de Terrazas o Portillo', 0, 425, 0),
  ('Chihuahua', 'Predio la Cantera', 0, 46477, 0),
  ('Chihuahua', 'Presidentes', 20000, 0, 0),
  ('Chihuahua', 'Rinconada de Oriente I', 14706, 0, 0),
  ('Chihuahua', 'Robinson', 12333, 936, 0),
  ('Chihuahua', 'San Felipe I', 39811, 0, 0),
  ('Chihuahua', 'San Felipe VI', 43728, 0, 0),
  ('Chihuahua', 'Secretaria de La Marina', 22500, 0, 0),
  ('Chihuahua', 'Sierra Azul', 0, 504, 0),
  ('Chihuahua', 'Unidad', 19000, 0, 0),
  ('Chihuahua', 'Veteranos de la Revolución', 11702, 0, 0);


-- ============================================================
-- SOURCE: 029_market_benchmarks_dataset34.sql
-- ============================================================
-- 29. MARKET BENCHMARKS — DATASET 34 (18 newly imported colonias) ----------
-- Populates market_benchmarks for 18 colonias of the dataset-34 import
-- (Chihuahua, venta ≤ $3,000,000 MXN) that lacked coverage, so the semáforo
-- RPC (compute_colonia_discount) can score every imported property.
--
-- Sources: no Wayback detail-page captures exist for these colonias, so
-- values are computed from captured list-card price/m² samples
-- (price ÷ size_m2), dedup'd per property.
--
-- Terreno-only colonias store the value in avg_price_m2_land (const=0);
-- all others use avg_price_m2_const.
--
-- Excluded (no size data in source cards): Ejido Rancho de En Medio.
-- That property has precio_m2_const NULL so the RPC returns NULL regardless;
-- a benchmark is impossible to compute without m² samples.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Agrícola Francisco Villa', 12195, 0, 0),
  ('Chihuahua', 'Barrio de Londres', 16438, 0, 0),
  ('Chihuahua', 'Benito Juárez CNOP', 0, 2718, 0),
  ('Chihuahua', 'Ejido Terrazas y Minas del Cobre', 0, 227, 0),
  ('Chihuahua', 'El Sacramento', 0, 900, 0),
  ('Chihuahua', 'Nuevo Chihuahua', 0, 7303, 0),
  ('Chihuahua', 'Nuevo Sacramento', 0, 267, 0),
  ('Chihuahua', 'Obrera', 13945, 0, 0),
  ('Chihuahua', 'Punta Oriente', 10909, 0, 0),
  ('Chihuahua', 'Quintas Carolinas I', 0, 488, 0),
  ('Chihuahua', 'Rincones de San Francisco', 0, 8035, 0),
  ('Chihuahua', 'Rincones de Sierra Azul', 0, 877, 0),
  ('Chihuahua', 'Robinson Residencial', 0, 1074, 0),
  ('Chihuahua', 'Roma V', 35950, 0, 0),
  ('Chihuahua', 'Sacramento I y II', 0, 380, 0),
  ('Chihuahua', 'Tabalaopa', 0, 1020, 0),
  ('Chihuahua', 'Valle Escondido', 0, 8900, 0),
  ('Chihuahua', 'Valle de Chihuahua', 0, 891, 0);


-- ============================================================
-- SOURCE: 030_market_benchmarks_dataset35.sql
-- ============================================================
-- 30. MARKET BENCHMARKS — DATASET 35 (1 newly imported colonia) -----------
-- Populates market_benchmarks for the Revolución colonia (dataset-35 import,
-- Chihuahua, venta ≤ $3,000,000 MXN) that lacked coverage, so the semáforo
-- RPC (compute_colonia_discount) can score every imported property.
--
-- Source: captured list-card price/m² sample (price ÷ size_m2) from the
-- single bodega listing in this colonia (pid 30562749, $2,597,000 / 186 m²).
--
-- Single-sample colonia: the property is its own benchmark, so the RPC
-- yields 0% discount (neutral, not hot) — consistent with existing single
-- sample colonias.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Revolución', 13962, 0, 0);


-- ============================================================
-- SOURCE: 031_market_benchmarks_coverage_sweep.sql
-- ============================================================
-- 31. MARKET BENCHMARKS — COVERAGE SWEEP (20 colonias) ------------------
-- Populates market_benchmarks for 20 remaining Chihuahua colonias (≤ $3,000,000
-- MXN market) that lacked coverage after datasets 24–35, so the semáforo RPC
-- (compute_colonia_discount) can score every in-market property.
--
-- Source: DB price/m² samples (price ÷ size_m2) per colonia. Over-$3M samples
-- (vivanuncios cross-listed properties outside the target market) are excluded,
-- per the dataset-34 precedent. Terreno-only colonias store the value in
-- avg_price_m2_land (const = 0).
--
-- Skipped (no reliable m² data): Quinta Sebastián, Los Llanos, Las Canteras,
-- Ejido Rancho de En Medio (const/terreno = 0), and Popular (data anomaly:
-- 80,000 m² for 2.2M MXN → 28/m², ~100x below all other benchmarks).

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Cerro de la Cruz', 16779, 19380, 0),
  ('Chihuahua', '11 de Febrero', 0, 1458, 0),
  ('Chihuahua', 'Cumbres de San Francisco', 0, 9000, 0),
  ('Chihuahua', 'Z-5 P1', 0, 16129, 0),
  ('Chihuahua', 'Los Frailes', 0, 17867, 0),
  ('Chihuahua', 'Los Girasoles IV Etapa', 14286, 14286, 0),
  ('Chihuahua', 'Pedregal del Valle', 0, 7250, 0),
  ('Chihuahua', 'Chulavista I Etapa', 14094, 6780, 0),
  ('Chihuahua', 'Los Girasoles III Etapa', 27660, 18978, 0),
  ('Chihuahua', 'Villa del Real', 25658, 15600, 0),
  ('Chihuahua', 'San Felipe I Etapa', 11250, 11250, 0),
  ('Chihuahua', 'Residencial', 19043, 17381, 0),
  ('Chihuahua', 'Fraccionamiento Cumbres', 0, 10400, 0),
  ('Chihuahua', 'Colina del Puerto', 13034, 13897, 0),
  ('Chihuahua', 'Paseos Camino Real', 25862, 7317, 0),
  ('Chihuahua', 'Plan de Ayala', 10638, 0, 0),
  ('Chihuahua', 'Pablo Amaya Norte', 7075, 0, 0),
  ('Chihuahua', 'Parque Industrial Chihuahua Sur', 0, 954, 0),
  ('Chihuahua', 'Veredas del Sur', 0, 1480, 0),
  ('Chihuahua', 'Haciendas del Rejón', 0, 26000, 0);


-- ============================================================
-- SOURCE: 032_market_benchmarks_dataset36.sql
-- ============================================================
-- 32. MARKET BENCHMARKS — DATASET 36 (10 colonias) ---------------------
-- Populates market_benchmarks for 10 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 47 dataset-36 imports (2023–2026 Wayback
-- captures of propiedades.com) that lacked coverage, so the semáforo RPC
-- (compute_colonia_discount) can score every in-market property.
--
-- Source: DB price/m² samples (price ÷ size_m2) per colonia. Over-$3M samples
-- (vivanuncios cross-listed properties outside the target market) are excluded.
-- Rancho listings whose LAND area lands in construccion_m2 (classifyCategory
-- maps Rancho→casa) produce land-in-const anomalies; those samples are excluded
-- from mixed colonias (Aeropuerto 1107, Granjas Familiares 700) and colonias
-- with only such samples are skipped. Terreno-only colonias store the value in
-- avg_price_m2_land (const = 0).
--
-- Skipped (no reliable m² data): Mezquites Sur, Cafetales, Campus II Uach,
-- Plomeros, Cantera del Pedregal (const/terreno = 0). Skipped (land-in-const
-- anomaly): Brisas del León (rancho 2500 m² → 384/m²), Avalos (rancho 600 m²
-- → 1833/m²) — rates 3–5× below the const p10 (2674), they are ranch LAND
-- prices, not construction rates.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Aeropuerto', 7188, 0, 0),
  ('Chihuahua', 'El Sáuz', 34375, 0, 0),
  ('Chihuahua', 'Granjas Familiares Valle de Chihuahua', 20313, 0, 0),
  ('Chihuahua', 'Haciendas del Valle II', 40845, 0, 0),
  ('Chihuahua', 'Insurgentes I', 0, 7389, 0),
  ('Chihuahua', 'Las Canteras', 37713, 0, 0),
  ('Chihuahua', 'Nuevo Majalca', 9615, 0, 0),
  ('Chihuahua', 'Paseo de las Misiones', 35432, 0, 0),
  ('Chihuahua', 'Puente de Piedra', 28252, 0, 0),
  ('Chihuahua', 'Villas del Sol I', 6141, 0, 0);


-- ============================================================
-- SOURCE: 033_market_benchmarks_dataset37.sql
-- ============================================================
-- 33. MARKET BENCHMARKS — DATASET 37 (4 colonias) ---------------------
-- Populates market_benchmarks for 4 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 13 dataset-37 imports (2023–2026 Wayback
-- captures of the propiedades.com root and /venta listing pages) that lacked
-- coverage, so the semáforo RPC (compute_colonia_discount) can score every
-- in-market property.
--
-- Source: DB price/m² samples (price ÷ size_m2) per colonia. Each of these
-- colonias has a single in-market sample, so the benchmark equals that
-- property's own rate (RPC discount = 0 until more samples arrive).
--
-- Skipped: México (terreno habitacional with land_area_m2 = 0 — no m² data).

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Campestre Residencial III', 20203, 0, 0),
  ('Chihuahua', 'La Joya', 19500, 0, 0),
  ('Chihuahua', 'Laura Leticia', 10000, 0, 0),
  ('Chihuahua', 'Residencial Campestre Washington', 20203, 0, 0);


-- ============================================================
-- SOURCE: 034_market_benchmarks_dataset38.sql
-- ============================================================
-- 34. MARKET BENCHMARKS — DATASET 38 (3 colonias) ---------------------
-- Populates market_benchmarks for 3 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 15 dataset-38 imports (2025–2026 Wayback
-- captures of the propiedades.com *-remates category pages) that lacked
-- coverage, so the semáforo RPC (compute_colonia_discount) can score every
-- in-market property.
--
-- Source: DB price/m² samples (price ÷ size_m2). Single in-market samples, so
-- the benchmarks equal each property's own rate (RPC discount = 0 until more
-- samples arrive). Rinconadas del Valle is a terreno-only colonia → stored in
-- avg_price_m2_land (const = 0); toHotScore returns null for terrenos, the
-- value feeds AVM estimateValue only.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Campestre las Carolinas', 3407, 0, 0),
  ('Chihuahua', 'Parque Industrial Impulso VII y VIII', 3662, 0, 0),
  ('Chihuahua', 'Rinconadas del Valle', 0, 3048, 0);


-- ============================================================
-- SOURCE: 035_market_benchmarks_dataset39.sql
-- ============================================================
-- 35. MARKET BENCHMARKS — DATASET 39 (3 colonias) ---------------------
-- Populates market_benchmarks for 3 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 11 dataset-39 imports (May 2024 Wayback
-- capture of propiedades.com/chihuahua-chihuahua/terrenos-comerciales-venta,
-- a pre-Next.js page whose listings live in __NEXT_DATA__.results.properties)
-- that lacked coverage, so the semáforo RPC (compute_colonia_discount) can
-- score every in-market property.
--
-- Source: DB price/m² samples (price ÷ size_m2). All three colonias are
-- terreno-comercial-only in this dataset → stored in avg_price_m2_land
-- (const = 0). Single in-market samples, so the benchmarks equal each
-- property's own rate; toHotScore returns null for terrenos, the values feed
-- AVM estimateValue only.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Vistas del Norte', 0, 176, 0),
  ('Chihuahua', 'Granjas Cerro Grande', 0, 600, 0),
  ('Chihuahua', 'El Bajo', 0, 1917, 0);


-- ============================================================
-- SOURCE: 036_market_benchmarks_dataset40.sql
-- ============================================================
-- 36. MARKET BENCHMARKS — DATASET 40 (16 colonias) --------------------
-- Populates market_benchmarks for 16 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 35 dataset-40 imports (2021 Wayback
-- captures of the propiedades.com /casas-venta and /locales-venta pages, a
-- pre-Next.js server-rendered schema whose cards are <div class="properties-list">)
-- that lacked coverage, so the semáforo RPC (compute_colonia_discount) can
-- score every in-market property.
--
-- Source: DB price/m² samples (price ÷ size_m2) per colonia. 15 of 16 are
-- single in-market samples (RPC discount = 0 until more samples arrive);
-- Ignacio Allende averages 2 local-comercial samples. All stored in
-- avg_price_m2_const (land = 0).

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Américas', 13218, 0, 0),
  ('Chihuahua', 'Atenas I, II, III, IV, V y VI', 7308, 0, 0),
  ('Chihuahua', 'Cafetales', 25854, 0, 0),
  ('Chihuahua', 'Cerrada Baena', 29333, 0, 0),
  ('Chihuahua', 'Condominos Comerciales Dumas I y II', 6109, 0, 0),
  ('Chihuahua', 'Guadalupe', 34630, 0, 0),
  ('Chihuahua', 'Ignacio Allende', 7804, 0, 0),
  ('Chihuahua', 'Jardines del Santuario', 23333, 0, 0),
  ('Chihuahua', 'La Galera I, II, III, IV y V', 14444, 0, 0),
  ('Chihuahua', 'Lomas Universidad II', 16667, 0, 0),
  ('Chihuahua', 'Poblado San Vicente', 14231, 0, 0),
  ('Chihuahua', 'Quinta Versalles', 15000, 0, 0),
  ('Chihuahua', 'Quintas Carolinas I, II, III, IV y V', 33621, 0, 0),
  ('Chihuahua', 'Rinconada de La Sierra I, II, III, IV y V', 11209, 0, 0),
  ('Chihuahua', 'San Ángel', 27027, 0, 0),
  ('Chihuahua', 'Satélite', 6160, 0, 0);


-- ============================================================
-- SOURCE: 037_market_benchmarks_dataset41.sql
-- ============================================================
-- 37. MARKET BENCHMARKS — DATASET 41 (31 colonias) --------------------
-- Populates market_benchmarks for 31 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 79 dataset-41 imports (2020–2022 Wayback
-- root captures of propiedades.com/chihuahua-chihuahua/venta — the last
-- unconsumed captures in the CDX window). This gives the semáforo RPC
-- (compute_colonia_discount) a benchmark to score every in-market property.
--
-- Source: DB price/m² samples (price ÷ size_m2) per colonia from all DB
-- properties (not just new imports). 30 of 31 are single in-market samples
-- (RPC discount = 0 until more samples arrive); Cumbres de San Francisco I y
-- II is a single terreno sample stored in avg_price_m2_land.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Adición Sur Universidad', 37667, 0, 0),
  ('Chihuahua', 'Campestre del Bosque', 4352, 0, 0),
  ('Chihuahua', 'Cerrada Ríoja', 16707, 0, 0),
  ('Chihuahua', 'Cima de La Cantera', 11859, 0, 0),
  ('Chihuahua', 'Colinas del León', 10952, 0, 0),
  ('Chihuahua', 'Cosmos', 14375, 0, 0),
  ('Chihuahua', 'Cumbres de San Francisco I y II', 0, 8224, 0),
  ('Chihuahua', 'Cumbres del Sur I', 13468, 0, 0),
  ('Chihuahua', 'El Porvenir I', 8663, 0, 0),
  ('Chihuahua', 'El Vallecillo', 12500, 0, 0),
  ('Chihuahua', 'Foxconn', 10526, 0, 0),
  ('Chihuahua', 'Fraccionamiento Puerta Rivera Real', 13253, 0, 0),
  ('Chihuahua', 'Francisco I Madero', 8929, 0, 0),
  ('Chihuahua', 'Haciendas Real', 13521, 0, 0),
  ('Chihuahua', 'Infonavit Nacional', 11400, 0, 0),
  ('Chihuahua', 'Karike', 11000, 0, 0),
  ('Chihuahua', 'La Molina', 17089, 0, 0),
  ('Chihuahua', 'Las Fuentes I', 11905, 0, 0),
  ('Chihuahua', 'Lomas Altas III', 39661, 0, 0),
  ('Chihuahua', 'Lomas del Rejón', 25687, 0, 0),
  ('Chihuahua', 'Lomas del Santuario I Etapa', 29080, 0, 0),
  ('Chihuahua', 'Los Encinos', 14141, 0, 0),
  ('Chihuahua', 'Misiones Universidad I, II y III', 11847, 0, 0),
  ('Chihuahua', 'Paseos de Chihuahua I y II', 9636, 0, 0),
  ('Chihuahua', 'Puerta del Valle I y II', 7987, 0, 0),
  ('Chihuahua', 'Residencial Universidad', 18087, 0, 0),
  ('Chihuahua', 'Roma II', 9091, 0, 0),
  ('Chihuahua', 'Roma Sur', 4044, 0, 0),
  ('Chihuahua', 'San Rafael', 6025, 0, 0),
  ('Chihuahua', 'Senda Real', 11475, 0, 0),
  ('Chihuahua', 'Junta de los Ríos "B" Ampl', 13483, 0, 0),
  ON CONFLICT (city, colonia) DO UPDATE SET
    avg_price_m2_const = EXCLUDED.avg_price_m2_const,
    avg_price_m2_land = EXCLUDED.avg_price_m2_land,
    historical_growth_rate = EXCLUDED.historical_growth_rate;


-- ============================================================
-- SOURCE: 038_market_benchmarks_dataset42.sql
-- ============================================================
-- 38. MARKET BENCHMARKS — DATASET 42 (104 colonias) -------------------
-- Populates market_benchmarks for 104 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 433 dataset-42 imports (2015–2016 and
-- 2018–2021 Wayback captures of propiedades.com/chihuahua-chihuahua
-- category pages — the second batch of unconsumed CDX captures). This gives
-- the semáforo RPC (compute_colonia_discount) a benchmark to score every
-- in-market property.
--
-- Source: DB price/m² samples (price ÷ size_m2) per colonia from all DB
-- properties (not just new imports), sanity-filtered (size ≥ 5 m², $/m²
-- within established benchmark ranges) to drop data-entry outliers
-- (misrecorded hectare lots priced in millions). const = avg for
-- non-terreno categories (construccion_m2); land = avg for terreno
-- (terreno_m2). Both stored when present; historical growth rate = 0.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Puerta de Hierro I', 36324, 3778, 0),
  ('Chihuahua', 'Puerta de Hierro IV', 36073, 0, 0),
  ('Chihuahua', 'Misión del Bosque', 35962, 0, 0),
  ('Chihuahua', 'Villas del Sur', 35432, 0, 0),
  ('Chihuahua', 'Las Misiones I, II, III y IV', 21902, 3988, 0),
  ('Chihuahua', 'Bosque Real', 10789, 10053, 0),
  ('Chihuahua', 'Vallarta', 16500, 0, 0),
  ('Chihuahua', 'Quintas de San Sebastián', 16289, 0, 0),
  ('Chihuahua', 'Alamedas IV', 15801, 0, 0),
  ('Chihuahua', 'Palestina Concordia', 14768, 825, 0),
  ('Chihuahua', 'Rinconada Universidad', 13061, 0, 0),
  ('Chihuahua', 'Riscos del Ángel', 12963, 0, 0),
  ('Chihuahua', 'Magisterial Universidad', 12469, 0, 0),
  ('Chihuahua', 'Las Águilas', 11842, 0, 0),
  ('Chihuahua', 'Ampliación Insurgentes', 9410, 2306, 0),
  ('Chihuahua', 'San Andrés', 11538, 0, 0),
  ('Chihuahua', 'Ejido Labor de Dolores', 11443, 0, 0),
  ('Chihuahua', 'Rincones del Picacho', 11272, 0, 0),
  ('Chihuahua', '20 Aniversario', 5574, 5600, 0),
  ('Chihuahua', 'Parque Industrial Impulso Habitacional', 0, 11111, 0),
  ('Chihuahua', 'Brisas del Real I', 10995, 0, 0),
  ('Chihuahua', 'Vista del Sol', 10625, 0, 0),
  ('Chihuahua', 'Villas del Sol I, II y III', 10545, 0, 0),
  ('Chihuahua', 'Villas de Nueva España', 10127, 0, 0),
  ('Chihuahua', 'Residencial Cumbres III', 9754, 0, 0),
  ('Chihuahua', 'Fuentes del Sol', 9701, 0, 0),
  ('Chihuahua', 'Zona Industrial Nombre de Dios', 9453, 0, 0),
  ('Chihuahua', 'Colon', 9449, 0, 0),
  ('Chihuahua', 'Arboledas II', 9143, 0, 0),
  ('Chihuahua', 'Chulavista II', 9106, 0, 0),
  ('Chihuahua', 'Colinas del Sol I y II', 9000, 0, 0),
  ('Chihuahua', 'Los Álamos Unidad', 8962, 0, 0),
  ('Chihuahua', 'San Cristóbal', 8945, 0, 0),
  ('Chihuahua', 'Quintas Juan Pablo I, II, III y IV', 7003, 1846, 0),
  ('Chihuahua', 'Riscos del Sol', 8791, 0, 0),
  ('Chihuahua', 'Las Aldabas I a La IX', 8763, 0, 0),
  ('Chihuahua', 'Acequias de Tabalaopa I y II', 8750, 0, 0),
  ('Chihuahua', 'Los Olivos I, II, III y IV', 8382, 0, 0),
  ('Chihuahua', 'Los Sicomoros', 8333, 0, 0),
  ('Chihuahua', 'Cordilleras I, II y III', 0, 8000, 0),
  ('Chihuahua', 'Real Carolinas I, II, III y IV', 7850, 0, 0),
  ('Chihuahua', 'Felipe Ángeles', 6374, 1210, 0),
  ('Chihuahua', 'Villa del Real I, II, III, IV y V', 7546, 0, 0),
  ('Chihuahua', 'Monte Vesubio', 7479, 0, 0),
  ('Chihuahua', 'Quintas Quijote I, II y III', 7443, 0, 0),
  ('Chihuahua', 'Popular I', 7285, 0, 0),
  ('Chihuahua', 'Rincón Parralense', 7265, 0, 0),
  ('Chihuahua', 'Lealtad', 7067, 0, 0),
  ('Chihuahua', 'Los Arroyos I, II y III', 6953, 0, 0),
  ('Chihuahua', 'Rincones de La Cima', 6897, 0, 0),
  ('Chihuahua', 'Alamedas V', 6801, 0, 0),
  ('Chihuahua', 'Cumbres Universidad I', 6410, 0, 0),
  ('Chihuahua', 'Solidaridad Popular', 6102, 0, 0),
  ('Chihuahua', 'Emiliano Zapata', 5616, 0, 0),
  ('Chihuahua', 'Lomas los Frailes', 5590, 0, 0),
  ('Chihuahua', 'José María Ponce de León', 5538, 0, 0),
  ('Chihuahua', 'Condominios FOVISSSTE', 5439, 0, 0),
  ('Chihuahua', 'Lagos', 5328, 0, 0),
  ('Chihuahua', 'Alamedas I', 5280, 0, 0),
  ('Chihuahua', 'Cantera del Pedregal', 0, 5231, 0),
  ('Chihuahua', 'Alamedas II', 5225, 0, 0),
  ('Chihuahua', 'Margarita Maza de Juárez', 5100, 0, 0),
  ('Chihuahua', 'Brasilia', 0, 5013, 0),
  ('Chihuahua', 'Vista Hermosa', 4949, 0, 0),
  ('Chihuahua', 'Insurgentes', 4634, 269, 0),
  ('Chihuahua', 'Los Girasoles II', 4873, 0, 0),
  ('Chihuahua', 'División del Norte Etapa I, II y III', 4498, 333, 0),
  ('Chihuahua', 'Residencial La Cantera I, II, III, IV y V', 0, 4800, 0),
  ('Chihuahua', 'Sector Salud', 4667, 0, 0),
  ('Chihuahua', 'Avícola I', 0, 4600, 0),
  ('Chihuahua', 'Aquiles Serdán', 4590, 0, 0),
  ('Chihuahua', 'Los Llanos', 4574, 0, 0),
  ('Chihuahua', 'Churubusco', 4368, 0, 0),
  ('Chihuahua', 'Vallarta Infonavit', 4368, 0, 0),
  ('Chihuahua', 'Juan Guereca', 4195, 0, 0),
  ('Chihuahua', 'Nuevo Triunfo', 4162, 0, 0),
  ('Chihuahua', 'Bosques de San Francisco I y II', 0, 4003, 0),
  ('Chihuahua', 'Francisco Domínguez', 3929, 0, 0),
  ('Chihuahua', 'San Agustin', 3899, 0, 0),
  ('Chihuahua', 'Puerta de Sebastián', 0, 3873, 0),
  ('Chihuahua', 'Villa Juárez (Rancheria Juárez)', 3685, 0, 0),
  ('Chihuahua', 'Universidad Regional del Norte', 0, 3438, 0),
  ('Chihuahua', 'Cerrada la Cantera', 0, 2866, 0),
  ('Chihuahua', 'Cumbres 4a Etapa', 0, 2796, 0),
  ('Chihuahua', 'Continental', 0, 2772, 0),
  ('Chihuahua', 'Mármol Viejo', 2635, 0, 0),
  ('Chihuahua', 'Quintas del Río', 0, 2307, 0),
  ('Chihuahua', 'Fuentes de Chihuahua', 2000, 0, 0),
  ('Chihuahua', 'Oscar Flores Sanchez', 0, 1841, 0),
  ('Chihuahua', 'Avalos', 1833, 0, 0),
  ('Chihuahua', 'San Guillermo', 1339, 0, 0),
  ('Chihuahua', 'Antigua Hacienda Tabaloapa', 1280, 0, 0),
  ('Chihuahua', 'Riberas del Sacramento I y II', 0, 1160, 0),
  ('Chihuahua', 'Las Huertas', 1156, 0, 0),
  ('Chihuahua', 'Campestre las Alamedas', 1100, 0, 0),
  ('Chihuahua', 'Praderas de León', 1019, 0, 0),
  ('Chihuahua', 'Las Acacias', 0, 917, 0),
  ('Chihuahua', 'La Concordia', 0, 848, 0),
  ('Chihuahua', 'Complejo Industrial Chihuahua', 0, 806, 0),
  ('Chihuahua', 'Las Torres', 0, 495, 0),
  ('Chihuahua', 'Chihuahua (General Roberto Fierro Villalobos)', 0, 440, 0),
  ('Chihuahua', 'San Isidro O los Hoyos', 0, 300, 0),
  ('Chihuahua', 'Granjas Universitarias', 0, 220, 0),
  ('Chihuahua', 'Ocampo O Torreón', 0, 194, 0)
ON CONFLICT (city, colonia) DO UPDATE SET
  avg_price_m2_const = EXCLUDED.avg_price_m2_const,
  avg_price_m2_land = EXCLUDED.avg_price_m2_land,
  historical_growth_rate = EXCLUDED.historical_growth_rate;


-- ============================================================
-- SOURCE: 039_market_benchmarks_dataset43.sql
-- ============================================================
-- 39. MARKET BENCHMARKS — DATASET 43 (353 colonias) -------------------
-- Populates market_benchmarks for 353 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 337 dataset-43 imports (April 2019
-- Wayback captures of propiedades.com/chihuahua-chihuahua pagination pages
-- ?pagina=N). This gives the semáforo RPC (compute_colonia_discount) a
-- benchmark to score every in-market property.
--
-- Source: DB price/m² samples (price ÷ size_m2) per colonia from all DB
-- properties (not just new imports), sanity-filtered (size ≥ 5 m², $/m²
-- within established benchmark ranges) to drop data-entry outliers
-- (misrecorded hectare lots priced in millions). const = avg for
-- non-terreno categories (construccion_m2); land = avg for terreno
-- (terreno_m2). Both stored when present; historical growth rate = 0.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', "11 de Febrero", 0, 1458, 0),
  ('Chihuahua', "1ro de Mayo", 8876, 0, 0),
  ('Chihuahua', "2 de Octubre y Ampliación", 7800, 0, 0),
  ('Chihuahua', "Abraham González", 11757, 0, 0),
  ('Chihuahua', "Adelitas I", 8097, 0, 0),
  ('Chihuahua', "Adición Sur Universidad", 37667, 0, 0),
  ('Chihuahua', "Aeropuerto", 3399, 2077, 0),
  ('Chihuahua', "Agrícola Francisco Villa", 7006, 1300, 0),
  ('Chihuahua', "Altamira", 9934, 0, 0),
  ('Chihuahua', "Ampliación Américas", 40714, 0, 0),
  ('Chihuahua', "Américas", 11033, 0, 0),
  ('Chihuahua', "Angel Trías", 17011, 0, 0),
  ('Chihuahua', "Ankara", 20340, 0, 0),
  ('Chihuahua', "Arboledas I", 10657, 0, 0),
  ('Chihuahua', "Arboledas V", 11232, 0, 0),
  ('Chihuahua', "Arcadas", 4808, 0, 0),
  ('Chihuahua', "Argeo", 2563, 0, 0),
  ('Chihuahua', "Arquitectos", 8440, 0, 0),
  ('Chihuahua', "Arquitos", 31765, 0, 0),
  ('Chihuahua', "Atenas I, II, III, IV, V y VI", 7308, 0, 0),
  ('Chihuahua', "Av Colegio", 21973, 21973, 0),
  ('Chihuahua', "Avícola II", 9252, 0, 0),
  ('Chihuahua', "Bahías", 27017, 0, 0),
  ('Chihuahua', "Barrio de Londres", 8780, 0, 0),
  ('Chihuahua', "Begonias", 13793, 0, 0),
  ('Chihuahua', "Bellavista", 8410, 0, 0),
  ('Chihuahua', "Benito Juárez CNOP", 0, 2718, 0),
  ('Chihuahua', "Bosques de San Pedro", 15101, 0, 0),
  ('Chihuahua', "Bosques de San Pedro 1", 21627, 24931, 0),
  ('Chihuahua', "Bosques del Valle", 9767, 5366, 0),
  ('Chihuahua', "CDP", 0, 1869, 0),
  ('Chihuahua', "Cafetales", 18852, 10445, 0),
  ('Chihuahua', "Caminos del Valle", 27174, 0, 0),
  ('Chihuahua', "Campanario", 9381, 0, 0),
  ('Chihuahua', "Campanario II", 0, 6107, 0),
  ('Chihuahua', "Campesina", 15055, 0, 0),
  ('Chihuahua', "Campestre Residencial I", 11829, 0, 0),
  ('Chihuahua', "Campestre Residencial II", 5563, 0, 0),
  ('Chihuahua', "Campestre Residencial III", 20203, 0, 0),
  ('Chihuahua', "Campestre del Bosque", 4352, 0, 0),
  ('Chihuahua', "Campestre las Carolinas", 8280, 1799, 0),
  ('Chihuahua', "Campestre-Lomas", 17674, 26233, 0),
  ('Chihuahua', "Campo Bello", 29167, 0, 0),
  ('Chihuahua', "Campo Bello Etapa I, II, III, IV, V y VI", 10008, 0, 0),
  ('Chihuahua', "Castilla Reliz", 22069, 0, 0),
  ('Chihuahua', "Catania Residencial", 9375, 0, 0),
  ('Chihuahua', "Cdp", 0, 2940, 0),
  ('Chihuahua', "Centro SCT Chihuahua", 5926, 4740, 0),
  ('Chihuahua', "Cerrada Baena", 29333, 0, 0),
  ('Chihuahua', "Cerrada Castilla", 26489, 16162, 0),
  ('Chihuahua', "Cerrada Navarra", 11727, 24012, 0),
  ('Chihuahua', "Cerrada Ríoja", 16707, 0, 0),
  ('Chihuahua', "Cerro Prieto", 0, 1344, 0),
  ('Chihuahua', "Cerro de La Cruz", 11263, 0, 0),
  ('Chihuahua', "Cerro de la Cruz", 16779, 19380, 0),
  ('Chihuahua', "Charros", 10599, 0, 0),
  ('Chihuahua', "Chihuahua Centro", 12828, 0, 0),
  ('Chihuahua', "Chihuahua I", 14540, 0, 0),
  ('Chihuahua', "Chihuahua II", 13608, 369, 0),
  ('Chihuahua', "Chihuahuense", 9773, 0, 0),
  ('Chihuahua', "Chuihuahua 2000", 35556, 35556, 0),
  ('Chihuahua', "Chulavista I", 15179, 0, 0),
  ('Chihuahua', "Chulavista I Etapa", 14094, 6780, 0),
  ('Chihuahua', "Cima de La Cantera", 19448, 0, 0),
  ('Chihuahua', "Ciudad Universitaria", 0, 2667, 0),
  ('Chihuahua', "Club Campestre", 4911, 0, 0),
  ('Chihuahua', "Colina del Puerto", 13034, 13897, 0),
  ('Chihuahua', "Colinas del León", 10952, 0, 0),
  ('Chihuahua', "Colinas del Sol III", 10350, 0, 0),
  ('Chihuahua', "Colinas del Valle", 15156, 17086, 0),
  ('Chihuahua', "Condesa Rejón", 30000, 30000, 0),
  ('Chihuahua', "Condominos Comerciales Dumas I y II", 6109, 0, 0),
  ('Chihuahua', "Cordilleras", 14024, 9750, 0),
  ('Chihuahua', "Cosmos", 14375, 0, 0),
  ('Chihuahua', "Country Club San Francisco", 0, 5200, 0),
  ('Chihuahua', "Crucero", 5392, 0, 0),
  ('Chihuahua', "Cuauhtémoc", 15924, 0, 0),
  ('Chihuahua', "Cumbres III Etapa", 20141, 21217, 0),
  ('Chihuahua', "Cumbres IV", 3293, 0, 0),
  ('Chihuahua', "Cumbres Universidad", 11902, 0, 0),
  ('Chihuahua', "Cumbres Universidad II", 5971, 0, 0),
  ('Chihuahua', "Cumbres de Robinson", 7333, 0, 0),
  ('Chihuahua', "Cumbres de San Francisco", 0, 9000, 0),
  ('Chihuahua', "Cumbres de San Francisco I y II", 0, 5953, 0),
  ('Chihuahua', "Cumbres del Sur I", 13468, 0, 0),
  ('Chihuahua', "Dale", 10044, 0, 0),
  ('Chihuahua', "De La Madre (10 de Mayo)", 11770, 0, 0),
  ('Chihuahua', "Diamante Reliz", 20966, 10842, 0),
  ('Chihuahua', "Diego Lucero", 7255, 0, 0),
  ('Chihuahua', "Ejidal", 2188, 2188, 0),
  ('Chihuahua', "Ejido Labor de Terrazas", 29949, 735, 0),
  ('Chihuahua', "Ejido Terrazas y Minas del Cobre", 0, 227, 0),
  ('Chihuahua', "El Bajo", 11598, 1917, 0),
  ('Chihuahua', "El Jardín", 2364, 0, 0),
  ('Chihuahua', "El Mineral I, II y III", 18462, 0, 0),
  ('Chihuahua', "El Palomar", 9000, 0, 0),
  ('Chihuahua', "El Porvenir I", 8663, 0, 0),
  ('Chihuahua', "El Sacramento", 0, 448, 0),
  ('Chihuahua', "El Sáuz", 34375, 100, 0),
  ('Chihuahua', "El Vallecillo", 12500, 0, 0),
  ('Chihuahua', "Encordada de León", 6359, 0, 0),
  ('Chihuahua', "Esperanza", 2667, 0, 0),
  ('Chihuahua', "Foxconn", 10526, 0, 0),
  ('Chihuahua', "Fraccionamiento Cumbres", 10400, 10400, 0),
  ('Chihuahua', "Fraccionamiento Cumbres de San Francisco", 25059, 35333, 0),
  ('Chihuahua', "Fraccionamiento Provincia de Santa Clara", 12588, 0, 0),
  ('Chihuahua', "Fraccionamiento Puerta Rivera Real", 13253, 0, 0),
  ('Chihuahua', "Francisco I Madero", 9868, 0, 0),
  ('Chihuahua', "Francisco R Almada", 22500, 5750, 0),
  ('Chihuahua', "Francisco Villa (Villa Vieja y Villa Nueva)", 5234, 0, 0),
  ('Chihuahua', "Fuentes del Santuario", 21902, 0, 0),
  ('Chihuahua', "Granjas Cerro Grande", 0, 600, 0),
  ('Chihuahua', "Granjas Familiares Valle de Chihuahua", 9001, 0, 0),
  ('Chihuahua', "Granjas del Valle", 1143, 1581, 0),
  ('Chihuahua', "Guadalupe", 26457, 0, 0),
  ('Chihuahua', "Hacienda Camila", 19116, 0, 0),
  ('Chihuahua', "Hacienda Isabella", 8565, 0, 0),
  ('Chihuahua', "Hacienda Santa Fe", 16071, 400, 0),
  ('Chihuahua', "Hacienda Victoria", 23414, 0, 0),
  ('Chihuahua', "Hacienda del Moro", 6148, 0, 0),
  ('Chihuahua', "Haciendas Real", 13521, 0, 0),
  ('Chihuahua', "Haciendas del Rejón", 0, 26000, 0),
  ('Chihuahua', "Haciendas del Valle II", 40845, 0, 0),
  ('Chihuahua', "Herradura Pdu", 5415, 0, 0),
  ('Chihuahua', "Ignacio Allende", 5883, 0, 0),
  ('Chihuahua', "Independencia", 5750, 0, 0),
  ('Chihuahua', "Industrial", 6479, 0, 0),
  ('Chihuahua', "Industrias", 6886, 0, 0),
  ('Chihuahua', "Infonavit Nacional", 9899, 23377, 0),
  ('Chihuahua', "Insurgentes I", 4212, 7389, 0),
  ('Chihuahua', "Insurgentes II", 0, 2555, 0),
  ('Chihuahua', "Jardines de Oriente", 11983, 1865, 0),
  ('Chihuahua', "Jardines de Oriente IX y X", 8840, 0, 0),
  ('Chihuahua', "Jardines de San Francisco", 41579, 41579, 0),
  ('Chihuahua', "Jardines del Sacramento", 7431, 0, 0),
  ('Chihuahua', "Jardines del Santuario", 32743, 0, 0),
  ('Chihuahua', "Jardines del Saucito", 45455, 0, 0),
  ('Chihuahua', "Jardines del Sol", 10433, 1851, 0),
  ('Chihuahua', "Junta de los Ríos \"B\" Ampl", 13483, 0, 0),
  ('Chihuahua', "Junta de los Ríos y Etapas", 11184, 0, 0),
  ('Chihuahua', "Juventud Norte", 20226, 20600, 0),
  ('Chihuahua', "Karike", 8140, 0, 0),
  ('Chihuahua', "La Cañada", 3889, 3768, 0),
  ('Chihuahua', "La Galera I, II, III, IV y V", 14444, 0, 0),
  ('Chihuahua', "La Haciendita", 31251, 0, 0),
  ('Chihuahua', "La Joya", 19500, 0, 0),
  ('Chihuahua', "La Molina", 17089, 0, 0),
  ('Chihuahua', "La Ribereña", 9703, 0, 0),
  ('Chihuahua', "Labor de Terrazas", 30206, 26846, 0),
  ('Chihuahua', "Las Animas", 22168, 1075, 0),
  ('Chihuahua', "Las Canteras", 29904, 6162, 0),
  ('Chihuahua', "Las Fuentes", 16285, 5987, 0),
  ('Chihuahua', "Las Fuentes I", 11905, 0, 0),
  ('Chihuahua', "Las Fuentes II", 6096, 0, 0),
  ('Chihuahua', "Las Granjas", 11043, 8024, 0),
  ('Chihuahua', "Las Palmas", 0, 300, 0),
  ('Chihuahua', "Las Quintas", 9901, 0, 0),
  ('Chihuahua', "Laura Leticia", 9281, 0, 0),
  ('Chihuahua', "Leones Universidad", 0, 10553, 0),
  ('Chihuahua', "Linss", 24407, 0, 0),
  ('Chihuahua', "Lomas Altas I", 15214, 3760, 0),
  ('Chihuahua', "Lomas Altas II", 13640, 0, 0),
  ('Chihuahua', "Lomas Altas III", 37210, 0, 0),
  ('Chihuahua', "Lomas Altas IV", 15710, 0, 0),
  ('Chihuahua', "Lomas Altas V", 0, 7968, 0),
  ('Chihuahua', "Lomas La Salle II", 2244, 0, 0),
  ('Chihuahua', "Lomas Montecarlo", 11234, 0, 0),
  ('Chihuahua', "Lomas Universidad I", 10211, 2230, 0),
  ('Chihuahua', "Lomas Universidad II", 16667, 0, 0),
  ('Chihuahua', "Lomas Universidad IV", 13693, 0, 0),
  ('Chihuahua', "Lomas Vallarta", 8359, 0, 0),
  ('Chihuahua', "Lomas del Rejón", 25687, 0, 0),
  ('Chihuahua', "Lomas del Santuario", 1733, 0, 0),
  ('Chihuahua', "Lomas del Santuario I Etapa", 27001, 2396, 0),
  ('Chihuahua', "Lomas del Santuario II Etapa", 42490, 4201, 0),
  ('Chihuahua', "Lomas del Sol II", 15886, 32143, 0),
  ('Chihuahua', "Lomas del Valle I y II", 22219, 0, 0),
  ('Chihuahua', "Los Claustros Universidad", 12320, 0, 0),
  ('Chihuahua', "Los Encinos", 14141, 0, 0),
  ('Chihuahua', "Los Frailes", 14012, 17867, 0),
  ('Chihuahua', "Los Girasoles III Etapa", 26953, 25289, 0),
  ('Chihuahua', "Los Girasoles IV Etapa", 14286, 14286, 0),
  ('Chihuahua', "Los Huertos", 16098, 0, 0),
  ('Chihuahua', "Los Naranjos", 6521, 0, 0),
  ('Chihuahua', "Los Nogales", 16860, 8235, 0),
  ('Chihuahua', "Los Pinos", 8775, 0, 0),
  ('Chihuahua', "Los Portales", 8273, 0, 0),
  ('Chihuahua', "Lourdes", 8077, 0, 0),
  ('Chihuahua', "Madera 65", 7073, 0, 0),
  ('Chihuahua', "Marielena Hernandez", 10000, 0, 0),
  ('Chihuahua', "Melchor Ocampo", 12687, 0, 0),
  ('Chihuahua', "Miguel Hidalgo", 9000, 0, 0),
  ('Chihuahua', "Mirador", 23748, 0, 0),
  ('Chihuahua', "Mision Universidad I", 4906, 0, 0),
  ('Chihuahua', "Misiones Universidad I, II y III", 16898, 0, 0),
  ('Chihuahua', "Misión del Bosque I Etapa", 22519, 33523, 0),
  ('Chihuahua', "Misión del Valle", 35432, 0, 0),
  ('Chihuahua', "Molino de Agua", 16480, 0, 0),
  ('Chihuahua', "Monte Caleres", 9843, 8600, 0),
  ('Chihuahua', "Monte Xenit", 4005, 0, 0),
  ('Chihuahua', "Montecarlo", 14815, 18433, 0),
  ('Chihuahua', "Monteverde", 20189, 13134, 0),
  ('Chihuahua', "Mármol I", 22698, 0, 0),
  ('Chihuahua', "Mármol III", 6651, 0, 0),
  ('Chihuahua', "Nacional", 11467, 0, 0),
  ('Chihuahua', "Niños Héroes", 6358, 0, 0),
  ('Chihuahua', "Nogales", 0, 451, 0),
  ('Chihuahua', "Nombre de Dios", 11099, 1090, 0),
  ('Chihuahua', "Nuevo Chihuahua", 11562, 7303, 0),
  ('Chihuahua', "Nuevo Majalca", 9615, 0, 0),
  ('Chihuahua', "Nuevo Sacramento", 0, 258, 0),
  ('Chihuahua', "Obrera", 6704, 3914, 0),
  ('Chihuahua', "Obrera Vista Avalos", 0, 3143, 0),
  ('Chihuahua', "Pablo Amaya Norte", 7075, 0, 0),
  ('Chihuahua', "Pacifico", 6510, 6811, 0),
  ('Chihuahua', "Panamericana", 19587, 20096, 0),
  ('Chihuahua', "Panorámico", 10555, 0, 0),
  ('Chihuahua', "Paquime", 5714, 0, 0),
  ('Chihuahua', "Parque Industrial Chihuahua Sur", 0, 954, 0),
  ('Chihuahua', "Parque Industrial Impulso", 3647, 120, 0),
  ('Chihuahua', "Parque Industrial Impulso VII y VIII", 3662, 0, 0),
  ('Chihuahua', "Parque Industrial Intermex Aeropuerto", 0, 467, 0),
  ('Chihuahua', "Parque Industrial Supra", 8027, 0, 0),
  ('Chihuahua', "Parques de San Felipe", 38418, 0, 0),
  ('Chihuahua', "Paseo de las Misiones", 19662, 9489, 0),
  ('Chihuahua', "Paseo de las Moras", 8917, 0, 0),
  ('Chihuahua', "Paseo de los Leones", 6306, 1770, 0),
  ('Chihuahua', "Paseos Camino Real", 25862, 7317, 0),
  ('Chihuahua', "Paseos de Chihuahua", 6033, 0, 0),
  ('Chihuahua', "Paseos de Chihuahua I y II", 9038, 0, 0),
  ('Chihuahua', "Paseos del Camino Real I, II, III y IV", 12500, 0, 0),
  ('Chihuahua', "Pavis Borunda", 6111, 0, 0),
  ('Chihuahua', "Pedregal del Real", 13750, 0, 0),
  ('Chihuahua', "Pedregal del Valle", 0, 7250, 0),
  ('Chihuahua', "Plan de Ayala", 10638, 0, 0),
  ('Chihuahua', "Plutarco Elías Calles", 7656, 15312, 0),
  ('Chihuahua', "Poblado La Haciendita", 0, 2243, 0),
  ('Chihuahua', "Poblado Labor de Terrazas o Portillo", 25458, 425, 0),
  ('Chihuahua', "Poblado San Vicente", 14231, 0, 0),
  ('Chihuahua', "Predio la Cantera", 0, 28938, 0),
  ('Chihuahua', "Presidentes", 20000, 0, 0),
  ('Chihuahua', "Provincia de Santa Clara Etapa I a La XII", 16432, 0, 0),
  ('Chihuahua', "Puente de Cantera", 14515, 8000, 0),
  ('Chihuahua', "Puente de Piedra", 28252, 0, 0),
  ('Chihuahua', "Puerta del Valle", 9655, 0, 0),
  ('Chihuahua', "Puerta del Valle I y II", 7327, 0, 0),
  ('Chihuahua', "Punta Oriente", 10909, 0, 0),
  ('Chihuahua', "Punto Alto II Etapa", 36506, 36122, 0),
  ('Chihuahua', "Quinta Versalles", 10402, 0, 0),
  ('Chihuahua', "Quintas Carolinas", 4123, 508, 0),
  ('Chihuahua', "Quintas Carolinas I", 15556, 488, 0),
  ('Chihuahua', "Quintas Carolinas I, II, III, IV y V", 22701, 665, 0),
  ('Chihuahua', "Quintas Juan Pablo", 9906, 0, 0),
  ('Chihuahua', "Quintas Montecarlo", 10309, 7574, 0),
  ('Chihuahua', "Quintas del Sol", 12518, 0, 0),
  ('Chihuahua', "Quintas del Sol II", 3542, 0, 0),
  ('Chihuahua', "Ramón Reyes", 8698, 0, 0),
  ('Chihuahua', "Real Universidad", 4347, 0, 0),
  ('Chihuahua', "Real de Minas", 13333, 0, 0),
  ('Chihuahua', "Reforma", 6226, 2771, 0),
  ('Chihuahua', "Residencial", 19043, 17381, 0),
  ('Chihuahua', "Residencial Campestre Washington", 14060, 0, 0),
  ('Chihuahua', "Residencial El León", 13498, 778, 0),
  ('Chihuahua', "Residencial Leones", 9053, 6155, 0),
  ('Chihuahua', "Residencial Universidad", 12139, 5457, 0),
  ('Chihuahua', "Residencial la Cantera", 2822, 0, 0),
  ('Chihuahua', "Revolución", 12997, 0, 0),
  ('Chihuahua', "Riberas del Sacramento", 0, 321, 0),
  ('Chihuahua', "Rigoberto Quiroz", 8911, 0, 0),
  ('Chihuahua', "Rinconada de La Sierra I, II, III, IV y V", 10868, 1780, 0),
  ('Chihuahua', "Rinconada de Oriente I", 14706, 0, 0),
  ('Chihuahua', "Rinconada los Nogales", 11852, 0, 0),
  ('Chihuahua', "Rinconadas de la Sierra", 7579, 0, 0),
  ('Chihuahua', "Rinconadas del Valle", 20259, 3048, 0),
  ('Chihuahua', "Rincones de San Francisco", 0, 8035, 0),
  ('Chihuahua', "Rincones de Sierra Azul", 0, 877, 0),
  ('Chihuahua', "Rincones del Pedregal", 14925, 0, 0),
  ('Chihuahua', "Rincón Colonial", 10640, 0, 0),
  ('Chihuahua', "Rincón de Los Huertos", 21370, 0, 0),
  ('Chihuahua', "Rincón de Zaragoza", 9498, 0, 0),
  ('Chihuahua', "Rincón de las Lomas I", 23062, 19342, 0),
  ('Chihuahua', "Rincón del Lago", 10050, 0, 0),
  ('Chihuahua', "Rio Sacramento Norte", 12813, 15132, 0),
  ('Chihuahua', "Riscos del Sol Etapa 2", 20530, 19745, 0),
  ('Chihuahua', "Robinson", 10513, 604, 0),
  ('Chihuahua', "Robinson Residencial", 9318, 1074, 0),
  ('Chihuahua', "Roma II", 9091, 0, 0),
  ('Chihuahua', "Roma Sur", 4044, 0, 0),
  ('Chihuahua', "Roma V", 35950, 0, 0),
  ('Chihuahua', "Romanzza", 10345, 16746, 0),
  ('Chihuahua', "Rosario", 6778, 1024, 0),
  ('Chihuahua', "Sacramento I y II", 7198, 258, 0),
  ('Chihuahua', "San Felipe I", 30856, 0, 0),
  ('Chihuahua', "San Felipe I Etapa", 20592, 12786, 0),
  ('Chihuahua', "San Felipe II", 38922, 0, 0),
  ('Chihuahua', "San Felipe II Etapa", 24619, 15686, 0),
  ('Chihuahua', "San Felipe III", 13793, 0, 0),
  ('Chihuahua', "San Felipe III Etapa", 16393, 18667, 0),
  ('Chihuahua', "San Felipe V", 2588, 0, 0),
  ('Chihuahua', "San Felipe V Etapa", 28125, 16364, 0),
  ('Chihuahua', "San Felipe VI", 43728, 0, 0),
  ('Chihuahua', "San Felipe Viejo", 15093, 0, 0),
  ('Chihuahua', "San Fernando", 16901, 0, 0),
  ('Chihuahua', "San Francisco I", 17384, 0, 0),
  ('Chihuahua', "San Jorge", 1588, 0, 0),
  ('Chihuahua', "San Miguel", 9802, 0, 0),
  ('Chihuahua', "San Rafael", 7333, 0, 0),
  ('Chihuahua', "San Ángel", 15764, 0, 0),
  ('Chihuahua', "Santa Rita", 10890, 0, 0),
  ('Chihuahua', "Santa Rosa", 11207, 8744, 0),
  ('Chihuahua', "Santo Domingo", 0, 699, 0),
  ('Chihuahua', "Santo Niño", 20003, 0, 0),
  ('Chihuahua', "Satélite", 6160, 0, 0),
  ('Chihuahua', "Saucito", 26544, 0, 0),
  ('Chihuahua', "Secretaria de La Marina", 22500, 0, 0),
  ('Chihuahua', "Sector Bolívar", 5266, 0, 0),
  ('Chihuahua', "Senda Real", 12123, 0, 0),
  ('Chihuahua', "Seratta 36", 14781, 0, 0),
  ('Chihuahua', "Sierra Azul", 0, 477, 0),
  ('Chihuahua', "Tabalaopa", 1062, 593, 0),
  ('Chihuahua', "Tec. de Monterrey", 8239, 0, 0),
  ('Chihuahua', "Tierra y Libertad", 9867, 3827, 0),
  ('Chihuahua', "Toribio Ortega", 7885, 0, 0),
  ('Chihuahua', "Tracia", 16561, 0, 0),
  ('Chihuahua', "Unidad", 19000, 0, 0),
  ('Chihuahua', "Unidad Cuauhtémoc", 37302, 6742, 0),
  ('Chihuahua', "Universitaria Ampliación I", 0, 440, 0),
  ('Chihuahua', "Valle Dorado", 5125, 555, 0),
  ('Chihuahua', "Valle Escondido", 28323, 8900, 0),
  ('Chihuahua', "Valle de Chihuahua", 0, 891, 0),
  ('Chihuahua', "Valle del Angel", 26827, 0, 0),
  ('Chihuahua', "Verde", 1653, 0, 0),
  ('Chihuahua', "Veredas de Sierra Azul", 10833, 0, 0),
  ('Chihuahua', "Veredas del Sur", 0, 1480, 0),
  ('Chihuahua', "Versalles", 4906, 0, 0),
  ('Chihuahua', "Veteranos de la Revolución", 7606, 1625, 0),
  ('Chihuahua', "Vicente Guerrero", 13223, 0, 0),
  ('Chihuahua', "Villa Juárez", 14244, 6198, 0),
  ('Chihuahua', "Villa Toscana", 13854, 0, 0),
  ('Chihuahua', "Villa del Real", 25658, 15600, 0),
  ('Chihuahua', "Villas del Rey I, II y III", 1961, 0, 0),
  ('Chihuahua', "Villas del Rey V", 5447, 2315, 0),
  ('Chihuahua', "Villas del Sol I", 6141, 0, 0),
  ('Chihuahua', "Virreyes I", 1132, 0, 0),
  ('Chihuahua', "Vistas Campestre", 1653, 0, 0),
  ('Chihuahua', "Vistas Cerro Grande", 2133, 0, 0),
  ('Chihuahua', "Vistas del Norte", 0, 176, 0),
  ('Chihuahua', "Z-5 P1", 18533, 16129, 0),
  ('Chihuahua', "Zarco", 23209, 0, 0),
  ('Chihuahua', "Zona Centro", 17089, 3813, 0),
  ('Chihuahua', "Zootecnia", 23333, 0, 0),
  ('Chihuahua', "Álamos", 8765, 0, 0),
  ('Chihuahua', "Ática", 30492, 0, 0),
;

-- ============================================================
-- SOURCE: 040_market_benchmarks_dataset44.sql
-- ============================================================
-- 40. MARKET BENCHMARKS — DATASET 44 (78 colonias) --------------------
-- Populates market_benchmarks for 78 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 602 dataset-44 imports (2015-2019
-- Wayback captures of propiedades.com/chihuahua-chihuahua pagination pages).
-- Source: DB price/m² samples (price ÷ size_m2) per colonia from all DB
-- properties, sanity-filtered (size ≥ 5 m², $/m² within benchmark ranges).
-- const = avg for non-terreno (construccion_m2); land = avg for terreno
-- (terreno_m2). Both stored when present; historical growth rate = 0.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', "-", 55440, 55440, 0),
  ('Chihuahua', "15 de Enero", 6818, 0, 0),
  ('Chihuahua', "Ampliación Unidad Proletaria", 5818, 0, 0),
  ('Chihuahua', "BAHIA DE BANDERAS", 9881, 0, 0),
  ('Chihuahua', "Barrancas", 10000, 0, 0),
  ('Chihuahua', "Bustamante", 7857, 0, 0),
  ('Chihuahua', "Campanario IV", 9661, 0, 0),
  ('Chihuahua', "Campus II Uach", 10492, 0, 0),
  ('Chihuahua', "Centro Ladrillero Norte", 10417, 0, 0),
  ('Chihuahua', "Cerrada de Cumbres", 0, 3869, 0),
  ('Chihuahua', "Cerrada del Parque", 35443, 0, 0),
  ('Chihuahua', "Cerro Grande", 6707, 0, 0),
  ('Chihuahua', "Chihuahua 2000 I Etapa", 4526, 0, 0),
  ('Chihuahua', "Chihuahua 2094", 31469, 0, 0),
  ('Chihuahua', "Claudia", 8000, 0, 0),
  ('Chihuahua', "DE LA OZ", 6000, 0, 0),
  ('Chihuahua', "Deportistas", 6273, 0, 0),
  ('Chihuahua', "Desarrollo Urbano", 4982, 0, 0),
  ('Chihuahua', "El Torreón", 6235, 0, 0),
  ('Chihuahua', "Encordada del Bosque", 11500, 0, 0),
  ('Chihuahua', "Floresta Residencial", 0, 5731, 0),
  ('Chihuahua', "Gloria", 6786, 0, 0),
  ('Chihuahua', "Granjas", 10593, 0, 0),
  ('Chihuahua', "Gustavo Diaz Ordaz", 6250, 0, 0),
  ('Chihuahua', "Haciendas del Valle I", 0, 4408, 0),
  ('Chihuahua', "Ignacio Rodriguez", 5250, 0, 0),
  ('Chihuahua', "Jardines de Ote Etapa I a La VIII", 5789, 0, 0),
  ('Chihuahua', "Jardines Universidad I", 11079, 0, 0),
  ('Chihuahua', "Laderas", 5556, 0, 0),
  ('Chihuahua', "Las Delicias", 0, 2100, 0),
  ('Chihuahua', "Latinoamericano", 2750, 0, 0),
  ('Chihuahua', "Lomas del Sol I", 10157, 0, 0),
  ('Chihuahua', "Lomas Karike", 8831, 0, 0),
  ('Chihuahua', "Lomas Universidad", 8547, 0, 0),
  ('Chihuahua', "Lomas Universidad III", 11000, 3242, 0),
  ('Chihuahua', "Los Girasoles I", 9069, 0, 0),
  ('Chihuahua', "Luis Fuentes Mares", 19966, 0, 0),
  ('Chihuahua', "Lázaro Cárdenas y Etapas", 4543, 0, 0),
  ('Chihuahua', "Mármol II", 6222, 0, 0),
  ('Chihuahua', "Parral", 10352, 0, 0),
  ('Chihuahua', "Pedro Domínguez", 4797, 0, 0),
  ('Chihuahua', "Plaza Saucito", 21687, 0, 0),
  ('Chihuahua', "praderas de banjul", 5921, 0, 0),
  ('Chihuahua', "Praderas del Sur II, III y IV", 6800, 0, 0),
  ('Chihuahua', "Provincia de Santa Clara XV-A y XV-B", 11281, 5100, 0),
  ('Chihuahua', "Puerta del Sol", 7688, 0, 0),
  ('Chihuahua', "Quintas Chihuahua", 0, 185, 0),
  ('Chihuahua', "Real de Potreros", 27273, 0, 0),
  ('Chihuahua', "Real San Juan", 7097, 0, 0),
  ('Chihuahua', "Residencial Campestre San Francisco", 1037, 0, 0),
  ('Chihuahua', "Residencial Cumbres I", 27682, 8000, 0),
  ('Chihuahua', "Residencial Nieves", 0, 5820, 0),
  ('Chihuahua', "Residencial Zarco", 11280, 0, 0),
  ('Chihuahua', "RINCONADA", 11111, 0, 0),
  ('Chihuahua', "Rinconada de Oriente I, II y III", 26885, 0, 0),
  ('Chihuahua', "Rincón de Los Ceresos", 9891, 0, 0),
  ('Chihuahua', "Rincón de Los Olivos", 45714, 0, 0),
  ('Chihuahua', "Rincón del Arcángel II", 9612, 0, 0),
  ('Chihuahua', "Roma III", 7212, 0, 0),
  ('Chihuahua', "Romance", 8911, 0, 0),
  ('Chihuahua', "Sahuaros I, II y III", 20755, 0, 0),
  ('Chihuahua', "San Carlos", 11266, 0, 0),
  ('Chihuahua', "San Lázaro", 0, 2178, 0),
  ('Chihuahua', "San Pablo", 9211, 0, 0),
  ('Chihuahua', "San Vicente", 20714, 0, 0),
  ('Chihuahua', "Santa Monica", 0, 417, 0),
  ('Chihuahua', "Sector 3 Robinson", 0, 1017, 0),
  ('Chihuahua', "Sergio de La Torre Hernandez I", 6566, 0, 0),
  ('Chihuahua', "TECNOLOGICO", 6122, 0, 0),
  ('Chihuahua', "Torres Rey", 8333, 0, 0),
  ('Chihuahua', "Unidad Proletaria", 0, 3155, 0),
  ('Chihuahua', "Unidad Universidad", 1786, 0, 0),
  ('Chihuahua', "Valle de La Madrid", 3929, 0, 0),
  ('Chihuahua', "Vicente Guereca", 2723, 0, 0),
  ('Chihuahua', "Vida Digna", 5357, 0, 0),
  ('Chihuahua', "Villa Dorada", 5822, 0, 0),
  ('Chihuahua', "Vistas del Sacramento", 3909, 0, 0),
  ('Chihuahua', "Zaragoza", 9516, 0, 0);


-- ============================================================
-- SOURCE: 041_market_benchmarks_dataset45.sql
-- ============================================================
-- 41. MARKET BENCHMARKS — DATASET 45 (14 colonias) --------------------
-- Populates market_benchmarks for 14 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 166 dataset-45 imports (2015/2017
-- Wayback captures of the propiedades.com/chihuahua-chihuahua root
-- pagination pages ?pagina=N). Source: DB price/m² samples (price ÷ size_m2)
-- per colonia, sanity-filtered (size ≥ 5 m², $/m² within benchmark ranges).
-- const = avg for non-terreno (construccion_m2); land = avg for terreno
-- (terreno_m2). Both stored when present; historical growth rate = 0.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', "Campanario III a", 6843, 0, 0),
  ('Chihuahua', "Francisco I. Madero Condominios", 7578, 0, 0),
  ('Chihuahua', "Fundadores", 0, 158, 0),
  ('Chihuahua', "Jardines de San Francisco I", 12605, 0, 0),
  ('Chihuahua', "jose maria ponce de leon", 4930, 0, 0),
  ('Chihuahua', "Los Naranjos I, II, III, IV, V y VI", 9600, 0, 0),
  ('Chihuahua', "Mezquites Sur", 0, 267, 0),
  ('Chihuahua', "Oasis Revolución", 4487, 0, 0),
  ('Chihuahua', "Puntas Naranjos Oriente I", 6522, 0, 0),
  ('Chihuahua', "Rinconada de Cervantes", 10435, 0, 0),
  ('Chihuahua', "Rincón Soberano", 9091, 0, 0),
  ('Chihuahua', "San Gabriel I y II", 7215, 0, 0),
  ('Chihuahua', "San Juan", 10590, 0, 0),
  ('Chihuahua', "Valle de San Pedro", 9231, 0, 0);


-- ============================================================
-- SOURCE: 042_market_benchmarks_dataset46.sql
-- ============================================================
-- 42. MARKET BENCHMARKS — DATASET 46 (14 colonias) --------------------
-- Populates market_benchmarks for 14 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 125 dataset-46 imports (2016–2020
-- Wayback captures of the propiedades.com/chihuahua-chihuahua root listing
-- page). Source: DB price/m² samples (price ÷ size_m2) per colonia,
-- sanity-filtered (size ≥ 5 m², $/m² within benchmark ranges).
-- const = avg for non-terreno (construccion_m2); land = avg for terreno
-- (terreno_m2). Both stored when present; historical growth rate = 0.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', "Porticos de Bella Cumbre", 8200, 0, 0),
  ('Chihuahua', "Los Olivos", 11894, 0, 0),
  ('Chihuahua', "Valle de San Lorenzo", 11166, 0, 0),
  ('Chihuahua', "San Francisco", 9231, 0, 0),
  ('Chihuahua', "Loma Dorada", 5792, 0, 0),
  ('Chihuahua', "Rincones de San Andrés", 7263, 0, 0),
  ('Chihuahua', "2 de Junio", 4696, 0, 0),
  ('Chihuahua', "Cuarteles", 7086, 0, 0),
  ('Chihuahua', "Misión del Valle II", 11132, 0, 0),
  ('Chihuahua', "Residencial Cumbres II", 12105, 0, 0),
  ('Chihuahua', "Lince I", 7009, 0, 0),
  ('Chihuahua', "Inalámbrica", 10364, 0, 0),
  ('Chihuahua', "San Ignacio", 6071, 0, 0),
  ('Chihuahua', "Robinson Sector IV", 11540, 0, 0)
ON CONFLICT (city, colonia) DO NOTHING;


-- ============================================================
-- SOURCE: 043_market_benchmarks_dataset47.sql
-- ============================================================
-- Dataset-47 (terrenos-habitacionales/industriales + industrial pages 2025-26)
-- New colonia benchmarks computed from imported Chihuahua venta properties.
INSERT INTO market_benchmarks (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES ('Chihuahua', 'Pozos del Valle', NULL, 350, 0)
ON CONFLICT (city, colonia) DO NOTHING;


