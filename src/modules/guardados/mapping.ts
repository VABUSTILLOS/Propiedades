import type {
  MarketplaceSavedListingsRow,
  PropertyCategory,
  PropertyDealType,
} from "@/modules/lib/database.types";

/**
 * Mapping from a saved Marketplace listing (marketplace_saved_listings) to
 * the payload accepted by createImportedDraft (importedPropertyDraftSchema).
 * Pure functions — no I/O — so the heuristics stay easy to audit.
 */

/**
 * Downtown Chihuahua. Saved listings carry no coordinates, so imported
 * drafts are born geocoded here as an approximation; the admin refines the
 * pin in the property wizard/editor before publishing.
 */
export const CHIHUAHUA_CENTER = { lat: 28.63581, lng: -106.07645 } as const;

/**
 * Property category heuristic over title + description (same keyword style
 * as scripts/import-propiedades.mjs classifyCategory).
 */
export function mapPropertyCategory(row: MarketplaceSavedListingsRow): PropertyCategory {
  const haystack = `${row.title} ${row.description ?? ""}`.toLowerCase();
  if (/\b(terreno|predio|lote|solar|parcela)\b/.test(haystack)) return "terreno";
  if (/\b(bodega|nave industrial|nave)\b/.test(haystack)) return "bodega";
  if (/\b(local|oficina|consultorio)\b/.test(haystack)) return "local";
  if (/\b(depto|departamento|depa)\b/.test(haystack)) return "departamento";
  return "casa";
}

/**
 * Deal type: rentals become 'renta' (supported since migration 046),
 * everything else is a direct sale. A listing counts as rental when
 * Marketplace already marked it Rented or its title says so — the title
 * check is deliberate: sale descriptions often mention "renta potencial"
 * for investors, which must not flip the deal type.
 */
export function mapDealType(row: MarketplaceSavedListingsRow): PropertyDealType {
  if (row.listing_status === "Rented") return "renta";
  if (/\brenta\b/i.test(row.title)) return "renta";
  return "venta_directa";
}

/** Positive number → rounded int (schema wants ints); anything else → null. */
function toPosIntOrNull(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

/**
 * Build the createImportedDraft payload for a saved property listing.
 *
 * Area mapping: Marketplace exposes a single area figure. For terrenos it
 * is the land; for everything else it is the built area (the land stays 0
 * and can be completed in the wizard before publishing).
 */
export function buildImportedDraftPayload(
  row: MarketplaceSavedListingsRow,
): Record<string, unknown> {
  const category = mapPropertyCategory(row);
  const area = row.area_m2 !== null && Number.isFinite(row.area_m2) && row.area_m2 > 0
    ? row.area_m2
    : 0;

  const gallery = (row.photo_urls ?? []).filter(isHttpUrl);
  const images = gallery.length > 0
    ? gallery.slice(0, 50)
    : row.primary_photo_url && isHttpUrl(row.primary_photo_url)
      ? [row.primary_photo_url]
      : [];

  const title = row.title.trim();
  const currency = /^[A-Za-z]{3}$/.test(row.currency) ? row.currency.toUpperCase() : "MXN";

  return {
    title: title.length >= 3 ? title.slice(0, 200) : "Propiedad de Marketplace",
    price: row.price !== null && Number.isFinite(row.price) && row.price > 0 ? row.price : 0,
    currency,
    category,
    deal_type: mapDealType(row),
    terreno_m2: category === "terreno" ? area : 0,
    construccion_m2: category === "terreno" ? 0 : area,
    recamaras: toPosIntOrNull(row.bedrooms),
    // Marketplace reports half baths (2.5); the schema wants ints and the
    // house convention (importer prompt) counts a half bath as 1 → round.
    banos: toPosIntOrNull(row.bathrooms),
    estacionamientos: null,
    antiguedad: null,
    // Full Marketplace description, capped at the schema limit.
    description: (row.description ?? "").slice(0, 5000),
    address: (row.location ?? "").slice(0, 200),
    colonia: (row.colonia ?? "").slice(0, 100),
    city: row.city?.trim() ? row.city.slice(0, 100) : "Chihuahua",
    state: "Chihuahua",
    zip_code: null,
    // Approximation: no coordinates in the saved data (see CHIHUAHUA_CENTER).
    lat: CHIHUAHUA_CENTER.lat,
    lng: CHIHUAHUA_CENTER.lng,
    images,
    bento_highlights: [],
    source_url:
      row.source_url && isHttpUrl(row.source_url)
        ? row.source_url
        : `https://www.facebook.com/marketplace/item/${row.listing_id}`,
  };
}
