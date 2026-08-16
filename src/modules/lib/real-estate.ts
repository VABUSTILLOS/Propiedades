import type { PropertiesRow, PropertyDealType } from "@/modules/lib/database.types";

/** Estimated annual property tax (predial) as a fraction of sale price. */
export const PREDIAL_RATE = 0.00265;
/** Estimated notary / closing (escrituración) costs as a fraction of sale price. */
export const ESCRITURACION_RATE = 0.08;
/** Estimated annual maintenance (mantenimiento) as a multiple of the estimated monthly rent. */
export const MANTENIMIENTO_RATE = 1.5;

export function estimatePredial(price: number): number {
  return Math.round(price * PREDIAL_RATE);
}

export function estimateEscrituracion(price: number): number {
  return Math.round(price * ESCRITURACION_RATE);
}

export function estimateMantenimiento(monthlyRent: number): number {
  return Math.round(monthlyRent * MANTENIMIENTO_RATE);
}

/**
 * Estimated monthly rent potential based on 85% of the listing price and the
 * property category. Local/bodega properties use a flat 0.85% rate; everything
 * else uses a tiered rate that decreases as the price increases.
 */
export function calcularPosibleRenta(
  property: Pick<PropertiesRow, "price" | "category">,
): number {
  const price = property.price * 0.85;
  const category = property.category;

  if (category === "local" || category === "bodega") {
    return price * 0.0085;
  }
  if (price <= 1_000_000) return price * 0.008;
  if (price <= 1_500_000) return price * 0.009;
  if (price <= 2_500_000) return price * 0.0075;
  if (price <= 3_500_000) return price * 0.007;
  return price * 0.006;
}

/**
 * Whether a buyer can prequalify for a mortgage on this deal type.
 * Bank foreclosures and traspasos are cash-only / own-resources transactions.
 */
export function isFinanciable(dealType: PropertyDealType): boolean {
  return dealType !== "remate_bancario" && dealType !== "traspaso";
}

export function formatMxn(amount: number): string {
  return `$${amount.toLocaleString("es-MX")}`;
}

export function formatMoney(amount: number, currency?: string | null): string {
  return `$${amount.toLocaleString("es-MX")} ${currency ?? ""}`.trim();
}

const compactMxn = new Intl.NumberFormat("es-MX", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Compact price pill for map markers, e.g. "$1.2M" or "$1.2M/mes". */
export function formatCompactPrice(
  price: number,
  type: PropertiesRow["type"],
): string {
  const amount = `$${compactMxn.format(price)}`;
  return type === "rent" ? `${amount}/mes` : amount;
}

type AreaMetricsProperty = Pick<
  PropertiesRow,
  "price" | "construccion_m2" | "terreno_m2" | "precio_m2_const" | "precio_m2_terreno"
>;

/** Price per constructed m²; falls back to the generated column when stored. */
export function getPrecioM2Const(property: AreaMetricsProperty): number | null {
  if (property.precio_m2_const != null) return property.precio_m2_const;
  return property.construccion_m2 > 0
    ? property.price / property.construccion_m2
    : null;
}

/** Price per land m²; falls back to the generated column when stored. */
export function getPrecioM2Terreno(property: AreaMetricsProperty): number | null {
  if (property.precio_m2_terreno != null) return property.precio_m2_terreno;
  return property.terreno_m2 > 0 ? property.price / property.terreno_m2 : null;
}

/** Whether the property is raw land (plot area present, no constructed area). */
export function isLandListing(
  property: Pick<PropertiesRow, "terreno_m2" | "construccion_m2">,
): boolean {
  return property.terreno_m2 > 0 && property.construccion_m2 === 0;
}

/** Human label for a listing type; land wins over rent/sale. */
export function propertyTypeLabel(
  type: PropertiesRow["type"],
  isLand = false,
): string {
  return isLand ? "Tierra" : type === "rent" ? "Renta" : "Venta";
}

/** Human label for a deal type (remate/flipping/traspaso/renta/venta directa). */
export function dealTypeLabel(
  dealType: PropertiesRow["deal_type"] | null | undefined,
): string {
  switch (dealType) {
    case "remate_bancario":
      return "Remate bancario";
    case "flipping":
      return "Flipping";
    case "traspaso":
      return "Traspaso";
    case "renta":
      return "Renta";
    default:
      return "Venta directa";
  }
}
