import { z } from "zod";

/**
 * Structured filters extracted from a natural-language message.
 * Mirrors the server-side SearchFilters minus pagination/sorting, so the
 * chat can hand them straight to `searchListings`.
 */
export const chatFiltersSchema = z.object({
  query: z.string().trim().max(200).optional(),
  type: z.enum(["sale", "rent"]).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  city: z.string().trim().max(100).optional(),
  colonia: z.string().trim().max(100).optional(),
  minM2: z.number().min(0).optional(),
  maxM2: z.number().min(0).optional(),
  minBedrooms: z.number().min(0).optional(),
  /** Only land listings (category = terreno). */
  isLand: z.boolean().optional(),
});

export type ChatFilters = z.infer<typeof chatFiltersSchema>;

/** Compact property shape returned to the chat client. */
export type ChatResult = {
  id: string;
  slug: string;
  title: string;
  city: string;
  colonia: string;
  price: number;
  currency: string;
  type: "sale" | "rent";
  image: string | null;
  score: number | null;
  recamaras: number | null;
  banos: number | null;
  construccion_m2: number;
  terreno_m2: number;
};

/** A single message in the chat conversation. */
export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  results?: ChatResult[];
};

/** JSON body returned by POST /api/chat. */
export type ChatResponse = {
  reply: string;
  results: ChatResult[];
  filters: ChatFilters;
};

/** Input contract for POST /api/chat. */
export const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Escribe tu criterio de búsqueda")
    .max(500),
  previousFilters: chatFiltersSchema.optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
