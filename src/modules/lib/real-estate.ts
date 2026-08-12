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
