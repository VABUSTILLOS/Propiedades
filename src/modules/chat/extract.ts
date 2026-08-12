import "server-only";

import { chatCompletion } from "@/modules/ai/server";
import { isStopword } from "@/modules/chat/interpret";
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
    system:
      "You are a search intent parser for a Mexican real-estate portal. " +
      "Extract structured filters from the user's natural-language query. " +
      'Respond with ONLY a JSON object using these fields (all optional): ' +
      '"city" (string, from the provided list), "type" ("sale"|"rent"), ' +
      '"minPrice" and "maxPrice" (numbers in MXN pesos, integers), ' +
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
  if (safe.city) filters.city = safe.city;
  if (safe.type) filters.type = safe.type;
  if (safe.isLand != null) filters.isLand = safe.isLand;

  const asNumber = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[$,]/g, "")) : NaN;
    return Number.isFinite(n) && n >= 0 && n <= 5_000_000_000 ? Math.round(n) : null;
  };
  const min = asNumber(raw.minPrice);
  const max = asNumber(raw.maxPrice);
  if (min != null) filters.minPrice = min;
  if (max != null) filters.maxPrice = max;

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
