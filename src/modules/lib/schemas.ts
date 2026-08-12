import { z } from "zod";

import type {
  BidStatus,
  ListingType,
  PaymentMethod,
  PropertyCategory,
  PropertyDealType,
  PropertyStatus,
  TransactionState,
  UserRole,
} from "@/modules/lib/database.types";

/**
 * Core domain schemas — single source of truth for every input boundary
 * (forms, URL params, Server Actions, webhooks, Edge Functions).
 */

// --- Shared primitives ------------------------------------------------------
export const uuidSchema = z.string().uuid();

export const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be a URL-safe slug");

export const mxnSchema = z
  .number({ message: "Price is required" })
  .min(0, "Price cannot be negative")
  .max(999_999_999_999, "Price is too large");

export const areaM2Schema = z
  .number()
  .min(0, "Area cannot be negative")
  .max(10_000_000, "Area is too large");

export const latSchema = z.number().min(-90).max(90);
export const lngSchema = z.number().min(-180).max(180);

// --- Enums ------------------------------------------------------------------
export const userRoleSchema = z.enum([
  "buyer",
  "investor",
  "agent",
  "owner_fsbo",
  "admin",
]) satisfies z.ZodType<UserRole>;

export const listingTypeSchema = z.enum(["sale", "rent"]) satisfies z.ZodType<ListingType>;

export const propertyCategorySchema = z.enum([
  "casa",
  "departamento",
  "local",
  "bodega",
  "terreno",
]) satisfies z.ZodType<PropertyCategory>;

export const propertyDealTypeSchema = z.enum([
  "venta_directa",
  "remate_bancario",
  "flipping",
  "traspaso",
]) satisfies z.ZodType<PropertyDealType>;

export const propertyStatusSchema = z.enum([
  "draft",
  "pending_approval",
  "active",
  "reserved",
  "sold",
  "archived",
]) satisfies z.ZodType<PropertyStatus>;

export const transactionStateSchema = z.enum([
  "inquired",
  "tour_pending",
  "tour_confirmed",
  "offer_pending",
  "offer_accepted",
  "in_escrow",
  "closed",
  "canceled",
]) satisfies z.ZodType<TransactionState>;

export const bidStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "countered",
]) satisfies z.ZodType<BidStatus>;

export const paymentMethodSchema = z.enum([
  "cash",
  "infonavit",
  "fonacot",
  "bank_loan",
  "mixed",
]) satisfies z.ZodType<PaymentMethod>;

// --- Pagination & search params ----------------------------------------------
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchParamsSchema = paginationSchema.extend({
  query: z.string().trim().max(200).optional(),
  type: listingTypeSchema.optional(),
  category: propertyCategorySchema.optional(),
  dealType: propertyDealTypeSchema.optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  city: z.string().trim().max(100).optional(),
  colonia: z.string().trim().max(100).optional(),
  minM2: z.coerce.number().min(0).optional(),
  maxM2: z.coerce.number().min(0).optional(),
  sortBy: z.enum(["price_asc", "price_desc", "newest", "score"]).default("newest"),
});

// --- Listados (portal page with tabs) ----------------------------------------------
export const listadosTabSchema = z.enum(["todos", "venta", "renta", "tierra"]);
export type ListadosTab = z.infer<typeof listadosTabSchema>;

/**
 * URL params for /listados. `tab` drives the portal tabs; the remaining
 * fields mirror searchParamsSchema so users can refine and switch tabs
 * without losing their filters.
 */
export const listadosParamsSchema = paginationSchema.extend({
  tab: listadosTabSchema.default("todos"),
  query: z.string().trim().max(200).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  city: z.string().trim().max(100).optional(),
  colonia: z.string().trim().max(100).optional(),
  minM2: z.coerce.number().min(0).optional(),
  maxM2: z.coerce.number().min(0).optional(),
  sortBy: z.enum(["price_asc", "price_desc", "newest", "score"]).default("newest"),
});
export type ListadosParams = z.infer<typeof listadosParamsSchema>;

// --- Investor dashboard (opportunity tabs) -------------------------------------
export const investorTabSchema = z.enum([
  "todos",
  "remate",
  "flipping",
  "traspaso",
  "comercial",
  "terreno",
]);
export type InvestorTab = z.infer<typeof investorTabSchema>;

/**
 * URL params for /investor. `tab` drives the opportunity dashboard tabs.
 */
export const investorParamsSchema = paginationSchema.extend({
  tab: investorTabSchema.default("todos"),
});
export type InvestorParams = z.infer<typeof investorParamsSchema>;

// --- Auth ---------------------------------------------------------------------
export const emailSchema = z.string().trim().email();

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128);

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  role: userRoleSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// --- Profiles -------------------------------------------------------------------
export const brandingConfigSchema = z.object({
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#0F172A"),
  logo_url: z.string().url().nullable().default(null),
  company_name: z.string().max(120).default(""),
  whatsapp_cta: z.string().max(40).default(""),
});

export const preapprovalDataSchema = z.object({
  infonavit_nss: z.string().max(20).nullable().default(null),
  max_credit: z.number().min(0).default(0),
  bank_preapproved: z.boolean().default(false),
  bank_name: z.string().max(120).nullable().default(null),
});

export const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().max(20).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  branding_config: brandingConfigSchema.optional(),
  preapproval_data: preapprovalDataSchema.optional(),
});

// --- Properties (wizard) -----------------------------------------------------------
export const propertyWizardStep1Schema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  type: listingTypeSchema,
  category: propertyCategorySchema.default("casa"),
  deal_type: propertyDealTypeSchema.default("venta_directa"),
  description: z.string().max(5000).optional(),
});

export const propertyWizardStep2Schema = z.object({
  price: mxnSchema,
  currency: z.string().length(3).default("MXN"),
  terreno_m2: areaM2Schema,
  construccion_m2: areaM2Schema,
  // Investment financial fields (set per deal_type; optional for direct sales).
  costo_reparacion_estimado: mxnSchema.nullable().optional(),
  valor_post_reparacion_estimado: mxnSchema.nullable().optional(),
  institucion_bancaria: z.string().trim().max(120).nullable().optional(),
  fecha_remate: z.string().date().nullable().optional(),
  condiciones_traspaso: z.string().trim().max(2000).nullable().optional(),
});

export const propertyWizardStep3Schema = z.object({
  address: z.string().trim().min(5).max(200),
  colonia: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  zip_code: z.string().max(10).optional(),
  lat: latSchema,
  lng: lngSchema,
});

export const propertyWizardStep4Schema = z.object({
  images: z.array(z.string().url()).max(50).default([]),
  tour_360_url: z.string().url().nullable().optional(),
  video_url: z.string().url().nullable().optional(),
});

export const propertyCreateSchema = propertyWizardStep1Schema
  .merge(propertyWizardStep2Schema)
  .merge(propertyWizardStep3Schema)
  .merge(propertyWizardStep4Schema);

export const propertyPublishSchema = z.object({
  status: propertyStatusSchema,
});

// --- Transactions ----------------------------------------------------------------
export const transactionCreateSchema = z.object({
  propertyId: uuidSchema,
});

export const transactionTransitionSchema = z.object({
  transactionId: uuidSchema,
  toState: transactionStateSchema,
});

// --- Messages ---------------------------------------------------------------------
/**
 * Action types embedded in `action_payload`. Reconciles the Sharetribe
 * message contract (tour_request / bid_submitted / bid_accepted /
 * status_change) with the transaction state machine's ACTION_MAPPINGS.
 */
export const messageActionTypeSchema = z.enum([
  "tour_request",
  "tour_accepted",
  "offer_submitted",
  "offer_accepted",
  "escrow_started",
  "deal_closed",
  "status_change",
  "canceled",
]);

export const messageActionPayloadSchema = z.object({
  type: messageActionTypeSchema,
  data: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Strict per-type validation of `action_payload.data`, used to decide
 * whether a message can render as an interactive card. Falls back to
 * plain text when the payload does not match its declared type.
 */
export const messageActionCardSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("tour_request"),
    data: z.object({
      slot_id: uuidSchema.optional(),
      start_time: z.string().datetime().optional(),
      end_time: z.string().datetime().optional(),
    }),
  }),
  z.object({
    type: z.literal("tour_accepted"),
    data: z.object({
      slot_id: uuidSchema.optional(),
      start_time: z.string().datetime().optional(),
      end_time: z.string().datetime().optional(),
    }),
  }),
  z.object({
    type: z.literal("offer_submitted"),
    data: z.object({
      bid_id: uuidSchema.optional(),
      offered_price: mxnSchema,
      payment_method: paymentMethodSchema.optional(),
    }),
  }),
  z.object({
    type: z.literal("offer_accepted"),
    data: z.object({
      bid_id: uuidSchema.optional(),
      offered_price: mxnSchema.optional(),
      counter_offer_price: mxnSchema.optional(),
    }),
  }),
  z.object({
    type: z.literal("escrow_started"),
    data: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    type: z.literal("deal_closed"),
    data: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    type: z.literal("canceled"),
    data: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    type: z.literal("status_change"),
    data: z.object({
      from: transactionStateSchema,
      to: transactionStateSchema,
    }),
  }),
]);

export type MessageActionType = z.infer<typeof messageActionTypeSchema>;
export type MessageActionPayload = z.infer<typeof messageActionPayloadSchema>;
export type MessageActionCard = z.infer<typeof messageActionCardSchema>;

export const messageCreateSchema = z.object({
  transactionId: uuidSchema,
  content: z.string().trim().min(1, "El mensaje no puede estar vacío").max(4000),
  is_system_event: z.boolean().default(false),
  action_payload: messageActionPayloadSchema.optional(),
});

/** Server-side event emission (system messages only). */
export const systemEventSchema = z.object({
  transactionId: uuidSchema,
  type: messageActionTypeSchema,
  data: z.record(z.string(), z.unknown()).default({}),
});

// --- Bookings ---------------------------------------------------------------------
export const slotCreateSchema = z.object({
  propertyId: uuidSchema,
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

export const slotBookSchema = z.object({
  slotId: uuidSchema,
  transactionId: uuidSchema.optional(),
});

// --- Reviews ----------------------------------------------------------------------
export const reviewCreateSchema = z.object({
  transactionId: uuidSchema,
  subjectId: uuidSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

// --- Favorites ----------------------------------------------------------------------
export const tierColumnSchema = z.enum(["top_choice", "plan_b", "discarded"]);
export type TierColumn = z.infer<typeof tierColumnSchema>;

export const favoriteUpsertSchema = z.object({
  propertyId: uuidSchema,
  tierRank: z.number().int().min(1).max(10).default(1),
  tierColumn: tierColumnSchema.default("top_choice"),
  privateNotes: z.string().max(2000).optional(),
});

export const favoriteReorderSchema = z.object({
  orderedIds: z.array(uuidSchema).min(1),
});

export const favoriteSetTierSchema = z.object({
  favoriteId: uuidSchema,
  tierColumn: tierColumnSchema,
});

export const favoriteKanbanReorderSchema = z.object({
  column: tierColumnSchema,
  orderedIds: z.array(uuidSchema).min(1),
});

// --- Favorites: custom lists ---------------------------------------------------
export const favoriteListCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre de la lista es requerido")
    .max(80, "El nombre no puede exceder 80 caracteres"),
  description: z
    .string()
    .trim()
    .max(500, "La descripción no puede exceder 500 caracteres")
    .optional(),
});

export const favoriteListUpdateSchema = favoriteListCreateSchema.extend({
  listId: uuidSchema,
});

/**
 * Add a property to one or more lists. Also ensures the property is saved
 * as a favorite (lists are linked to favorites).
 */
export const favoriteListAddSchema = z.object({
  propertyId: uuidSchema,
  listIds: z.array(uuidSchema).max(100),
});

export const favoriteListRemoveItemSchema = z.object({
  listId: uuidSchema,
  favoriteId: uuidSchema,
});

// --- Bids ----------------------------------------------------------------------------
export const bidCreateSchema = z.object({
  propertyId: uuidSchema,
  transactionId: uuidSchema.optional(),
  offeredPrice: mxnSchema,
  paymentMethod: paymentMethodSchema,
});

export const bidRespondSchema = z.object({
  bidId: uuidSchema,
  status: bidStatusSchema,
  counterOfferPrice: mxnSchema.optional(),
});

// --- Market data -----------------------------------------------------------------------
export const marketBenchmarkSchema = z.object({
  city: z.string().trim().min(1).max(100),
  colonia: z.string().trim().min(1).max(100),
  avg_price_m2_const: mxnSchema,
  avg_price_m2_land: mxnSchema,
  historical_growth_rate: z.number().min(-100).max(1000).default(0),
});

// --- Digital flyers --------------------------------------------------------------------
export const flyerCreateSchema = z.object({
  propertyId: uuidSchema,
  customTitle: z.string().trim().max(120).optional(),
  isWhiteLabel: z.boolean().default(false),
});

export const flyerAnalyticsSchema = z.object({
  flyerId: uuidSchema,
  visitorSessionId: z.string().trim().min(1).max(200),
  timeSpentSeconds: z.number().int().min(0).max(86_400).default(0),
  sectionsViewed: z
    .record(z.string(), z.number().int().min(0))
    .default({}),
});

export const flyerLeadSchema = z.object({
  flyerId: uuidSchema,
  visitorSessionId: z.string().trim().min(1).max(200),
  email: emailSchema.optional(),
  phone: z.string().trim().max(30).optional(),
});

// --- Ingestion (Stage 2: multimodal import) ------------------------------------------
export const ingestionSourceSchema = z.enum(["url", "text", "voice"]);

export const ingestionRequestSchema = z.object({
  source: ingestionSourceSchema,
  content: z.string().trim().min(3, "Content is too short").max(50_000),
});

/**
 * Strict JSON contract returned by DeepSeek for a property import.
 * `puntos_fuertes_bento` drives the Bento-grid highlights on the card.
 */
export const aiExtractedPropertySchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  precio: mxnSchema,
  recamaras: z.number().int().min(0).max(50).nullable().default(null),
  banos: z.number().int().min(0).max(50).nullable().default(null),
  amenidades_array: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  puntos_fuertes_bento: z
    .array(z.string().trim().min(1).max(140))
    .max(6)
    .default([]),
  colonia: z.string().trim().max(100).nullable().default(null),
  city: z.string().trim().max(100).nullable().default(null),
  precio_m2_const: mxnSchema.optional(),
});

export type AiExtractedProperty = z.infer<typeof aiExtractedPropertySchema>;

// --- Local surveys (Stage 4 "What Locals Say") -----------------------------------------
export const localSurveyCreateSchema = z.object({
  propertyId: uuidSchema,
  safetyRating: z.number().int().min(1).max(5),
  noiseRating: z.number().int().min(1).max(5),
  walkabilityRating: z.number().int().min(1).max(5),
  petFriendlyRating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

// --- Co-shopping (Stage 6) -----------------------------------------------------------------
export const coShoppingVoteSchema = z.object({
  favoriteId: uuidSchema,
  vote: z.enum(["like", "dislike"]),
});

export const coShoppingInviteSchema = z.object({
  favoriteId: uuidSchema,
  coBuyerEmail: emailSchema,
});

export const coShoppingMessageSchema = z.object({
  favoriteId: uuidSchema,
  content: z.string().trim().min(1, "El mensaje no puede estar vacío").max(2000),
});
