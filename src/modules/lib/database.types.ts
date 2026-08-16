/**
 * Generated-aligned Database types for the Propiedades schema.
 * Mirrors supabase/migrations/001_init.sql 1:1.
 * NOTE: Regenerate with `supabase gen types typescript` once a live project exists.
 */

export type UserRole = "buyer" | "investor" | "agent" | "owner_fsbo" | "admin";
export type ListingType = "sale" | "rent";
export type PropertyCategory =
  | "casa"
  | "departamento"
  | "local"
  | "bodega"
  | "terreno";
export type PropertyDealType =
  | "venta_directa"
  | "remate_bancario"
  | "flipping"
  | "traspaso"
  | "renta";
export type PropertyStatus =
  | "draft"
  | "pending_approval"
  | "active"
  | "reserved"
  | "sold"
  | "archived";
export type IntakeStatus = "procesando" | "borrador_incompleto" | "activo";
export type IntakeChannel = "whatsapp" | "web";
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
  owner_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  type: ListingType;
  status: PropertyStatus;
  current_wizard_step: number | null;
  category: PropertyCategory;
  deal_type: PropertyDealType;
  costo_reparacion_estimado: number | null;
  valor_post_reparacion_estimado: number | null;
  institucion_bancaria: string | null;
  fecha_remate: string | null;
  condiciones_traspaso: string | null;
  contact_name: string | null;
  contact_type: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  contact_email: string | null;
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
  image_count: number | null;
  image_sources: string[] | null;
  tour_360_url: string | null;
  video_url: string | null;
  recamaras: number | null;
  banos: number | null;
  estacionamientos: number | null;
  antiguedad: number | null;
  amenidades: Json;
  puntos_fuertes_bento: Json;
  embedding: unknown | null;
  // "Sube tu propiedad" intake flow (migration 045)
  intake_status: IntakeStatus | null;
  intake_channel: IntakeChannel | null;
  wa_id: string | null;
  wa_profile_name: string | null;
  ai_raw_text: string | null;
  ai_extracted: Json;
  missing_fields: string[];
  intake_token: string | null;
  intake_expires_at: string | null;
  // Media generation (migration 049)
  generated_video_url: string | null;
  generated_video_vertical_url: string | null;
  generated_tour_url: string | null;
  generated_tour_type: string | null;
  media_generation_status: string | null;
  media_generation_updated_at: string | null;
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

export type MediaGenerationJobRow = {
  id: string;
  property_id: string;
  user_id: string;
  job_type: "video" | "tour" | "social_cuts" | "all";
  status: "pending" | "processing" | "done" | "failed" | "cancelled";
  progress: number;
  input_images: Json;
  output_video_url: string | null;
  output_video_vertical_url: string | null;
  output_tour_url: string | null;
  output_tour_type: "panorama_360" | "walkthrough" | "none" | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

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
  white_label_source_flyer_id: string | null;
  views_count: number | null;
  created_at: string;
  updated_at: string;
}

export type PropertyLocalSurveysRow = {
  id: string;
  property_id: string;
  author_id: string;
  safety_rating: number | null;
  noise_rating: number | null;
  walkability_rating: number | null;
  pet_friendly_rating: number | null;
  comment: string | null;
  is_verified: boolean | null;
  created_at: string;
  updated_at: string;
}

export type CoShoppingChatRow = {
  id: string;
  favorite_id: string;
  sender_id: string;
  content: string;
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

export type MortgageLeadsRow = {
  id: string;
  property_id: string | null;
  property_title: string | null;
  property_price: number | null;
  full_name: string;
  phone: string;
  email: string;
  simulated_monthly_payment: number | null;
  simulated_down_payment: number | null;
  simulation: Json;
  created_at: string;
}

export type WhatsappMessagesRow = {
  id: string;
  wa_message_id: string | null;
  wa_id: string;
  profile_name: string | null;
  phone_number: string | null;
  body: string | null;
  message_type: string;
  media_type: string | null;
  media_url: string | null;
  metadata: Json;
  flyer_id: string | null;
  property_id: string | null;
  is_read: boolean;
  created_at: string;
}

export type BuyerFavoritesRow = {
  id: string;
  user_id: string;
  property_id: string;
  tier_rank: number;
  tier_column: string;
  private_notes: string | null;
  user_photos: string[] | null;
  co_buyer_votes: Json;
  created_at: string;
  updated_at: string;
}

export type FavoriteListsRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type FavoriteListItemsRow = {
  id: string;
  list_id: string;
  favorite_id: string;
  position: number;
  created_at: string;
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
      favorite_lists: { Row: FavoriteListsRow; Insert: Insertable<FavoriteListsRow>; Update: Partial<FavoriteListsRow>; Relationships: [] };
      favorite_list_items: { Row: FavoriteListItemsRow; Insert: Insertable<FavoriteListItemsRow>; Update: Partial<FavoriteListItemsRow>; Relationships: [] };
      bids: { Row: BidsRow; Insert: Insertable<BidsRow>; Update: Partial<BidsRow>; Relationships: [] };
      property_local_surveys: { Row: PropertyLocalSurveysRow; Insert: Insertable<PropertyLocalSurveysRow>; Update: Partial<PropertyLocalSurveysRow>; Relationships: [] };
      co_shopping_chat: { Row: CoShoppingChatRow; Insert: Insertable<CoShoppingChatRow>; Update: Partial<CoShoppingChatRow>; Relationships: [] };
      whatsapp_messages: { Row: WhatsappMessagesRow; Insert: Insertable<WhatsappMessagesRow>; Update: Partial<WhatsappMessagesRow>; Relationships: [] };
      mortgage_leads: { Row: MortgageLeadsRow; Insert: Insertable<MortgageLeadsRow>; Update: Partial<MortgageLeadsRow>; Relationships: [] };
      media_generation_jobs: { Row: MediaGenerationJobRow; Insert: Insertable<MediaGenerationJobRow>; Update: Partial<MediaGenerationJobRow>; Relationships: [] };
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
      compute_colonia_discounts: {
        Args: { p_ids: string[] };
        Returns: { property_id: string; discount_pct: number }[];
      };
      list_active_cities: {
        Args: Record<string, never>;
        Returns: { city: string; active_count: number }[];
      };
      list_active_colonias: {
        Args: { p_type?: string | null };
        Returns: { colonia: string }[];
      };
      compute_investor_metrics: {
        Args: { target_property_id: string };
        Returns: Json;
      };
      recompute_profile_rating: {
        Args: { subject_profile_id: string };
        Returns: undefined;
      };
      match_properties: {
        Args: { query_embedding: string; match_count: number };
        Returns: { id: string; similarity: number }[];
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
