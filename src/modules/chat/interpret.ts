import type { ChatFilters } from "@/modules/chat/types";

/**
 * Deterministic regex-based interpretation of a natural-language query.
 * Used as a fallback when the LLM extractor is unavailable (no API key or
 * provider error), and as the source of truth for price/type/land parsing.
 * Kept dependency-free and side-effect-free so it is trivial to test.
 */

// Multiplier suffixes recognised in price amounts.
const MILLION = 1_000_000;
const THOUSAND = 1_000;

/**
 * Candidate price expressions. Captures:
 *   - "$2,000,000" / "$2,000,000 MXN"
 *   - "2 millones" / "1.5 mdd" / "15 mil" / "2m" (attached m = millones)
 *   - bare "mil" / "millón" / "mdd"
 * The spaced "m" suffix is intentionally excluded to avoid matching "200 m"
 * (metres of terrain).
 */
const PRICE_CANDIDATE =
  /\$\s*\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s*(?:mdd|millones?|mill[oó]n|mil|k|mxn|pesos)\b|\d[\d,]*(?:\.\d+)?m\b|\b(?:mil|mdd|mill[oó]n(?:es)?)\b/gi;

/** Parse a single price token into a number of pesos, or null when it is not an amount. */
function parseAmountToken(raw: string): number | null {
  let t = raw.trim().toLowerCase().replace("$", "").replace(/\s+/g, " ");
  // Strip currency words: "2,000,000 mxn", "3 millones de pesos"
  t = t.replace(/\s*(?:pesos\s*mexicanos?|mxn|pesos|usd)$/, "");
  t = t.replace(/\s+de\s+pesos$/, "");

  const suffix = t.match(/^([\d.,]+)\s*(mdd|mill[oó]n(?:es)?|mil|k|m)$/);
  if (suffix) {
    const amount = suffix[1] ?? "";
    const kind = suffix[2] ?? "";
    const num = Number(amount.replace(/,/g, ""));
    // "mdd", "m" and any "mill*" form are millions; "mil"/"k" are thousands.
    const mult = kind === "mdd" || kind === "m" || /^mill/.test(kind) ? MILLION : THOUSAND;
    return num * mult;
  }
  if (t === "mil") return THOUSAND;
  if (t === "mdd" || /^mill[oó]n(?:es)?$/.test(t)) return MILLION;

  const bare = t.replace(/,/g, "");
  if (/^\d+(?:\.\d+)?$/.test(bare)) return Number(bare);
  return null;
}

type PriceMatch = { value: number; index: number };

/** Extract every price expression in the text, in order of appearance. */
function findPriceExpressions(text: string): PriceMatch[] {
  const matches: PriceMatch[] = [];
  for (const m of text.matchAll(PRICE_CANDIDATE)) {
    const value = parseAmountToken(m[0]);
    if (value == null) continue;
    matches.push({ value, index: m.index ?? 0 });
  }
  return matches;
}

/**
 * Classify the price expressions as min/max based on surrounding words.
 *   - "entre X y Y" → min = X, max = Y
 *   - "desde X" / "más de X" / "mínimo X" → min
 *   - "hasta X" / "menos de X" / "máximo X" / "por menos de X" → max
 *   - a single amount is treated as a budget ceiling (maxPrice).
 */
function classifyPrices(text: string, prices: PriceMatch[]): { minPrice?: number; maxPrice?: number } {
  if (prices.length === 0) return {};

  // Compound amount: "1 millon 200 mil" → 1,200,000
  const compound = text.match(
    /(\d[\d,.]*)\s*(?:mill[oó]n(?:es)?|mdd)\s+(?:y\s+)?(\d[\d,.]*)\s+mil\b/,
  );
  if (compound) {
    const millions = Number(compound[1]!.replace(/,/g, ""));
    const thousands = Number(compound[2]!.replace(/,/g, ""));
    return { maxPrice: millions * MILLION + thousands * THOUSAND };
  }

  // "entre X y Y" — capture both amounts even when bare ("entre 2 y 3 millones").
  const between = text.match(
    /entre\s+([\d$][\d.,\s]*(?:mill[oó]n(?:es)?|mdd|mil|k|mxn|pesos)?)\s+y\s+([\d$][\d.,\s]*(?:mill[oó]n(?:es)?|mdd|mil|k|mxn|pesos)?)/,
  );
  if (between) {
    const lo = parseAmountToken(between[1] ?? "");
    const hi = parseAmountToken(between[2] ?? "");
    if (lo != null && hi != null) {
      // Bare numbers in a range that mentions millions are interpreted in millions.
      const mentionsMillions = /mill[oó]n|mdd/.test(text);
      const min = mentionsMillions && lo < MILLION ? lo * MILLION : lo;
      const max = mentionsMillions && hi < MILLION ? hi * MILLION : hi;
      return { minPrice: min, maxPrice: max };
    }
  }

  const first = prices[0]!;
  const before = text.slice(0, first.index).toLowerCase();
  const isMin =
    /(?:desde|m[áa]s\s+de|m[íi]nimo|m[íi]n|por\s+lo\s+menos|cuando\s+menos)\s*[^a-z]*$/.test(before);
  const isMax =
    /(?:hasta|menos\s+de|m[áa]ximo|m[áa]x|por\s+menos\s+de|no\s+m[áa]s\s+de)\s*[^a-z]*$/.test(before);

  if (isMin) return { minPrice: first.value };
  if (isMax) return { maxPrice: first.value };

  // Default: a bare amount reads as the user's budget ceiling.
  return { maxPrice: first.value };
}

/** Longest city name wins so "Ciudad Juárez" beats "Juárez". */
function findCity(text: string, cities: string[]): string | undefined {
  const sorted = [...cities].sort((a, b) => b.length - a.length);
  for (const city of sorted) {
    const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) return city;
  }
  return undefined;
}

// Stopwords never become part of the keyword query.
const STOPWORDS = new Set([
  "de", "en", "para", "por", "con", "que", "y", "o", "a", "el", "la", "los",
  "las", "un", "una", "unos", "unas", "mi", "tu", "su", "del", "al", "quiero",
  "busco", "necesito", "me", "se", "les", "tambien", "también", "mas", "más",
  "menos", "hasta", "desde", "entre", "sobre", "cerca", "propiedades",
  "propiedad", "inmuebles", "inmueble", "vivienda", "viviendas", "renta",
  "rentar", "arrendar", "arriendo", "alquiler", "rento", "venta", "comprar",
  "compro", "vendo", "vender", "adquirir", "encuentro", "hay", "quieres",
  "puedes", "mexico", "méxico", "mxn", "pesos", "chihuahua", "juarez",
  "juárez", "mil", "millones", "millón", "millon", "mdd", "por", "que",
  "asi", "así", "estoy", "estamos", "usuario", "hola", "buenas", "dias",
  "días", "tardes", "noches", "favor", "ayuda", "ciudad", "colonia",
  // Low-signal price adjectives: they indicate intent but are useless as
  // search keywords, so they must not overwrite a previous turn's query.
  "barato", "barata", "baratos", "baratas", "caro", "cara", "caros", "caras",
]);

/**
 * Whether a token is too generic to use as a search keyword. Shared with the
 * LLM extractor so both interpretation paths reject the same low-signal words.
 */
export function isStopword(token: string): boolean {
  const t = token.toLowerCase().trim();
  return t.length < 3 || /^\d+$/.test(t) || STOPWORDS.has(t);
}

// High-value keywords are preferred when building the ilike query.
const KEYWORD_PRIORITY = [
  "alberca", "patio", "jardin", "jardín", "cochera", "estacionamiento",
  "bodega", "local", "oficina", "penthouse", "duplex", "ph", "residencial",
  "fraccionamiento", "condominio", "suite", "loft", "amueblado", "amueblada",
  "semi-amueblado", "nuevo", "nueva", "remodelado", "esquina", "recamaras",
  "recámaras", "habitacion", "habitaciones", "estudio", "económico",
  "oportunidad", "casas", "casa", "departamentos", "departamento", "depa",
  "depas", "terrenos", "terreno", "lotes", "lote",
];

/** Pick the single best keyword token for the ilike search. */
function extractKeyword(text: string): string | undefined {
  const tokens = text
    .toLowerCase()
    .split(/[^a-záéíóúñü0-9]+/i)
    .filter((t) => !isStopword(t));

  // Prefer high-value keywords regardless of token order in the sentence.
  // A prefix match also catches plural/simple inflections ("locales" → "local").
  for (const keyword of KEYWORD_PRIORITY) {
    if (tokens.some((t) => t.startsWith(keyword))) return keyword;
  }
  // Fall back to the longest meaningful token.
  return tokens.sort((a, b) => b.length - a.length)[0];
}

/**
 * Interpret a natural-language query into structured ChatFilters.
 * Returns an empty filter set when nothing recognisable is found.
 */
export function interpretQuery(query: string, cities: string[]): ChatFilters {
  const text = query.trim().toLowerCase();
  const filters: ChatFilters = {};

  const city = findCity(text, cities);
  if (city) filters.city = city;

  const prices = findPriceExpressions(text);
  const { minPrice, maxPrice } = classifyPrices(text, prices);
  if (minPrice != null) filters.minPrice = minPrice;
  if (maxPrice != null) filters.maxPrice = maxPrice;

  if (/\b(renta|rentar|arrendar|arriendo|alquiler|rento)\b/.test(text)) {
    filters.type = "rent";
  } else if (/\b(venta|comprar|compro|vendo|vender|adquirir)\b/.test(text)) {
    filters.type = "sale";
  }

  if (/\b(terrenos?|lotes?)\b/.test(text)) {
    filters.isLand = true;
  }

  const keyword = extractKeyword(text);
  if (keyword) filters.query = keyword;

  return filters;
}
