import type { PropertyDealType } from "@/modules/lib/database.types";

/** Estimated annual property tax (predial) as a fraction of sale price. */
export const PREDIAL_RATE = 0.00265;
/** Estimated notary / closing (escrituración) costs as a fraction of sale price. */
export const ESCRITURACION_RATE = 0.08;

export function estimatePredial(price: number): number {
  return Math.round(price * PREDIAL_RATE);
}

export function estimateEscrituracion(price: number): number {
  return Math.round(price * ESCRITURACION_RATE);
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
