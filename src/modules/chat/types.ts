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
  estacionamientos: number | null;
  antiguedad: number | null;
  construccion_m2: number;
  terreno_m2: number;
  /** True when this result was found by relaxing a requested filter (alternatives mode). */
  relaxed?: boolean;
};

/** Describes which requested filters were dropped to produce relaxed results. */
export type ChatRelaxedInfo = {
  /** Human-readable names of the dropped filters (e.g. ["ciudad", "precio"]). */
  dropped: string[];
  /** Short note for the reply, e.g. "Mostrando resultados sin filtro de ciudad." */
  note: string;
};

/** A single message in the chat conversation. */
export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  results?: ChatResult[];
  /** Filters that produced the reply, so the widget can show "Entendí" chips. */
  filters?: ChatFilters;
  /** False when the strict search found nothing (drives the alternatives button). */
  matched?: boolean;
  /** Present when the results were relaxed; the widget shows an "Alternativa" badge. */
  relaxed?: ChatRelaxedInfo;
  /** For assistant turns: the user message that produced this reply, so the
   *  "Ver alternativas" button can re-send it with includeAlternatives. */
  requestMessage?: string;
};

/** JSON body returned by POST /api/chat. */
export type ChatResponse = {
  reply: string;
  results: ChatResult[];
  filters: ChatFilters;
  /** False when the strict search found nothing (honest "no results" reply). */
  matched: boolean;
  /** Present when the reply is showing relaxed (alternative) results. */
  relaxed?: ChatRelaxedInfo;
};

/** Input contract for POST /api/chat. */
export const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Escribe tu criterio de búsqueda")
    .max(500),
  previousFilters: chatFiltersSchema.optional(),
  /** Ask the bot to relax filters and show "alternativas" when the strict search is empty. */
  includeAlternatives: z.boolean().optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
