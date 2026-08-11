/**
 * Generated-aligned Database types for the Propiedades schema.
 * Mirrors supabase/migrations/001_init.sql 1:1.
 * NOTE: Regenerate with `supabase gen types typescript` once a live project exists.
 */

export type UserRole = "buyer" | "investor" | "agent" | "owner_fsbo" | "admin";
export type ListingType = "sale" | "rent";
export type PropertyStatus =
  | "draft"
  | "pending_approval"
  | "active"
  | "reserved"
  | "sold"
  | "archived";
export type TransactionState =
  | "inquired"
  | "tour_pending"
  | "tour_confirmed"
  | "offer_pending"
  | "offer_accepted"
  | "in_escrow"
  | "closed"
  | "canceled";
export type BidStatus = "pending" | "accepted" | "rejected" | "countered";
export type PaymentMethod = "cash" | "infonavit" | "fonacot" | "bank_loan" | "mixed";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProfilesRow = {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  subdomain: string | null;
  branding_config: Json;
  preapproval_data: Json;
  rating_average: number | null;
  reviews_count: number | null;
  created_at: string;
  updated_at: string;
}

export type MarketBenchmarksRow = {
  id: string;
  city: string;
  colonia: string;
  avg_price_m2_const: number;
  avg_price_m2_land: number;
  historical_growth_rate: number | null;
  updated_at: string;
}

export type PropertiesRow = {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  description: string | null;
  type: ListingType;
  status: PropertyStatus;
  current_wizard_step: number | null;
  price: number;
  currency: string;
  terreno_m2: number;
  construccion_m2: number;
  precio_m2_const: number | null;
  precio_m2_terreno: number | null;
  valor_avaluo: number | null;
  porcentaje_descuento_avaluo: number | null;
  estimated_monthly_rent: number | null;
  cap_rate_projected: number | null;
  hoa_fee: number | null;
  predial_anual: number | null;
  price_history: Json;
  tax_history: Json;
  address: string;
  colonia: string;
  city: string;
  state: string;
  zip_code: string | null;
  lat: number;
  lng: number;
  geog: unknown | null;
  neighborhood_vibe: Json;
  noise_score: number | null;
  flood_risk_level: string | null;
  nearby_schools: Json;
  is_top: boolean | null;
  property_score: number | null;
  is_mls: boolean | null;
  commission_split: string | null;
  private_notes: string | null;
  source_url: string | null;
  images: string[] | null;
  tour_360_url: string | null;
  video_url: string | null;
  embedding: unknown | null;
  created_at: string;
  updated_at: string;
}

export type TransactionsRow = {
  id: string;
  property_id: string;
  buyer_id: string;
  listing_owner_id: string;
  state: TransactionState;
  last_transition_at: string;
  created_at: string;
  updated_at: string;
}

export type MessagesRow = {
  id: string;
  transaction_id: string;
  sender_id: string;
  content: string;
  is_system_event: boolean | null;
  action_payload: Json | null;
  created_at: string;
  updated_at: string;
}

export type AvailabilitySlotsRow = {
  id: string;
  property_id: string;
  agent_or_owner_id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean | null;
  booked_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ReviewsRow = {
  id: string;
  transaction_id: string;
  author_id: string;
  subject_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export type DigitalFlyersRow = {
  id: string;
  property_id: string;
  agent_id: string;
  slug: string;
  custom_title: string | null;
  is_white_label: boolean | null;
  views_count: number | null;
  created_at: string;
  updated_at: string;
}

export type FlyerAnalyticsRow = {
  id: string;
  flyer_id: string;
  visitor_session_id: string;
  opened_at: string;
  time_spent_seconds: number | null;
  sections_viewed: Json;
  engagement_score: number | null;
  lead_email: string | null;
  lead_phone: string | null;
  updated_at: string;
}

export type BuyerFavoritesRow = {
  id: string;
  user_id: string;
  property_id: string;
  tier_rank: number;
  private_notes: string | null;
  user_photos: string[] | null;
  co_buyer_votes: Json;
  created_at: string;
  updated_at: string;
}

export type BidsRow = {
  id: string;
  transaction_id: string | null;
  property_id: string;
  buyer_id: string;
  offered_price: number;
  payment_method: PaymentMethod;
  status: BidStatus;
  counter_offer_price: number | null;
  created_at: string;
  updated_at: string;
}

type Insertable<T> = { [K in keyof T]?: T[K] | null };

export type Database = {
  public: {
    Tables: {
      profiles: { Row: ProfilesRow; Insert: Insertable<ProfilesRow>; Update: Partial<ProfilesRow>; Relationships: [] };
      market_benchmarks: { Row: MarketBenchmarksRow; Insert: Insertable<MarketBenchmarksRow>; Update: Partial<MarketBenchmarksRow>; Relationships: [] };
      properties: { Row: PropertiesRow; Insert: Insertable<PropertiesRow>; Update: Partial<PropertiesRow>; Relationships: [] };
      transactions: { Row: TransactionsRow; Insert: Insertable<TransactionsRow>; Update: Partial<TransactionsRow>; Relationships: [] };
      messages: { Row: MessagesRow; Insert: Insertable<MessagesRow>; Update: Partial<MessagesRow>; Relationships: [] };
      availability_slots: { Row: AvailabilitySlotsRow; Insert: Insertable<AvailabilitySlotsRow>; Update: Partial<AvailabilitySlotsRow>; Relationships: [] };
      reviews: { Row: ReviewsRow; Insert: Insertable<ReviewsRow>; Update: Partial<ReviewsRow>; Relationships: [] };
      digital_flyers: { Row: DigitalFlyersRow; Insert: Insertable<DigitalFlyersRow>; Update: Partial<DigitalFlyersRow>; Relationships: [] };
      flyer_analytics: { Row: FlyerAnalyticsRow; Insert: Insertable<FlyerAnalyticsRow>; Update: Partial<FlyerAnalyticsRow>; Relationships: [] };
      buyer_favorites: { Row: BuyerFavoritesRow; Insert: Insertable<BuyerFavoritesRow>; Update: Partial<BuyerFavoritesRow>; Relationships: [] };
      bids: { Row: BidsRow; Insert: Insertable<BidsRow>; Update: Partial<BidsRow>; Relationships: [] };
    };
    Views: Record<string, never>,
    Functions: {
      compute_engagement_score: {
        Args: { sections: Json };
        Returns: number;
      };
      compute_cap_rate: {
        Args: { price: number; monthly_rent: number };
        Returns: number | null;
      };
      compute_colonia_discount: {
        Args: { target_property_id: string };
        Returns: number | null;
      };
      compute_investor_metrics: {
        Args: { target_property_id: string };
        Returns: Json;
      };
      recompute_profile_rating: {
        Args: { subject_profile_id: string };
        Returns: undefined;
      };
    },
    Enums: {
      user_role: UserRole;
      listing_type: ListingType;
      property_status: PropertyStatus;
      transaction_state: TransactionState;
      bid_status: BidStatus;
      payment_method: PaymentMethod;
    };
    CompositeTypes: Record<string, never>;
  };
}
