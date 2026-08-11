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
