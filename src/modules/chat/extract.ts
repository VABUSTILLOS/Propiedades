import "server-only";

import { chatCompletion } from "@/modules/ai/server";
import { isStopword, normalizeCityName } from "@/modules/chat/interpret";
import type { ChatFilters } from "@/modules/chat/types";

/**
 * LLM-based query interpretation. Uses the existing multi-provider
 * `chatCompletion` (DeepSeek → kie.ai) with jsonMode. Returns null on any
 * failure so the orchestrator can fall back to the regex parser — the same
 * graceful-degradation pattern used across the repo.
 */

type Extraction = {
  city?: string;
  type?: "sale" | "rent";
  minPrice?: number;
  maxPrice?: number;
  isLand?: boolean;
  minM2?: number;
  maxM2?: number;
  minBedrooms?: number;
  query?: string;
};

/** Strip ```json fences and parse. Mirrors extractJson in modules/ai/server.ts. */
function parseJsonPayload(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced && fenced[1]) ?? text;
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
}

/** Guard against values that would break searchListings. */
function sanitize(city: string[], type: string[], isLand: string[]): Extraction | null {
  const values: string[] = [];
  values.push(...city, ...type, ...isLand);
  if (values.some((v) => typeof v !== "string" || v.length > 100)) return null;

  const extraction: Extraction = {};
  const c = city[0];
  if (c) extraction.city = c;
  const t = type[0];
  if (t === "sale" || t === "rent") extraction.type = t;
  const l = isLand[0];
  if (l === "true" || l === "false") extraction.isLand = l === "true";
  return extraction;
}

/**
 * Extract search filters from a user message using the LLM.
 * The system prompt explicitly whitelists the enum values to keep the model
 * honest; numeric prices are constrained to a sane range. Returns null when
 * the LLM is unavailable or returns unusable output.
 */
export async function extractFilters(message: string, cities: string[]): Promise<ChatFilters | null> {
  const result = await chatCompletion({
    jsonMode: true,
    temperature: 0.2,
    // deepseek-v4-flash is a reasoning model: it spends most of its budget on
    // chain-of-thought. The default 400-token cap leaves content empty, so we
    // must reserve enough tokens for the JSON payload itself.
    maxTokens: 2000,
    system:
      "You are a search intent parser for a Mexican real-estate portal. " +
      "Extract structured filters from the user's natural-language query. " +
      'Respond with ONLY a JSON object using these fields (all optional): ' +
      '"city" (string, from the provided list — use the exact catalog spelling, e.g. "Juárez" for "Ciudad Juárez"), ' +
      '"type" ("sale"|"rent"), ' +
      '"minPrice" and "maxPrice" (numbers in MXN pesos, integers). ' +
      'A SINGLE amount such as "de 2,000,000 MXN" is a budget ceiling: ' +
      'emit ONLY "maxPrice", never minPrice === maxPrice. ' +
      '"minM2" and "maxM2" (numbers, square metres; a bare figure like "500 m²" is a minimum). ' +
      '"minBedrooms" (number, when the user asks for rooms/bedrooms). ' +
      '"isLand" (boolean, true when the user asks for land/lotes/terrenos), ' +
      '"query" (short string, a meaningful keyword like "alberca" or "2 recamaras"). ' +
      "Do not invent cities outside the provided list. Do not add fields.",
    user:
      `Available cities: ${cities.join(", ") || "none"}.\n` +
      `User message: "${message}"`,
  });

  const text = result?.content ?? null;
  if (!text) return null;

  const parsed = parseJsonPayload(text);
  if (!parsed || typeof parsed !== "object") return null;

  const raw = parsed as Record<string, unknown>;
  const safe = sanitize(
    Array.isArray(raw.city) ? raw.city.map(String) : raw.city != null ? [String(raw.city)] : [],
    Array.isArray(raw.type) ? raw.type.map(String) : raw.type != null ? [String(raw.type)] : [],
    Array.isArray(raw.isLand) ? raw.isLand.map(String) : raw.isLand != null ? [String(raw.isLand)] : [],
  );
  if (!safe) return null;

  const filters: ChatFilters = {};
  if (safe.city) {
    const city = normalizeCityName(safe.city, cities);
    if (city) filters.city = city;
  }
  if (safe.type) filters.type = safe.type;
  if (safe.isLand != null) filters.isLand = safe.isLand;

  const asNumber = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[$,]/g, "")) : NaN;
    return Number.isFinite(n) && n >= 0 && n <= 5_000_000_000 ? Math.round(n) : null;
  };
  const asArea = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[,\s]/g, "")) : NaN;
    return Number.isFinite(n) && n > 0 && n <= 1_000_000 ? Math.round(n) : null;
  };

  let min = asNumber(raw.minPrice);
  const max = asNumber(raw.maxPrice);
  // A single amount is a budget ceiling: drop minPrice when it equals maxPrice.
  if (min != null && max != null && min === max) min = null;
  if (min != null) filters.minPrice = min;
  if (max != null) filters.maxPrice = max;

  const minM2 = asArea(raw.minM2);
  const maxM2 = asArea(raw.maxM2);
  if (minM2 != null) filters.minM2 = minM2;
  if (maxM2 != null) filters.maxM2 = maxM2;

  const minBedrooms = asNumber(raw.minBedrooms);
  if (minBedrooms != null && minBedrooms <= 100) filters.minBedrooms = minBedrooms;

  if (typeof raw.query === "string" && raw.query.trim()) {
    // Reject low-signal words ("baratas", "nuevas") so a follow-up refinement
    // can't overwrite the previous turn's meaningful keyword.
    const words = raw.query.trim().toLowerCase().split(/\s+/);
    if (words.some((w) => !isStopword(w))) {
      filters.query = raw.query.trim().slice(0, 200);
    }
  }

  return filters;
}
