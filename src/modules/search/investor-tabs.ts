import type { SearchFilters } from "@/modules/search/queries";
import type {
  PropertyCategory,
  PropertyDealType,
} from "@/modules/lib/database.types";
import type { InvestorTab } from "@/modules/lib/schemas";

export const TAB_LABELS: Record<InvestorTab, string> = {
  todos: "todas las oportunidades",
  remate: "remates bancarios",
  flipping: "propiedades para reparar",
  traspaso: "traspasos inmobiliarios",
  comercial: "locales y bodegas",
  terreno: "terrenos",
};

/** Implicit property categories per opportunity tab. */
const TAB_CATEGORIES: Partial<Record<InvestorTab, PropertyCategory[]>> = {
  comercial: ["local", "bodega"],
  terreno: ["terreno"],
};

/**
 * Sentinel category that can never match a real row. Used when the user's
 * multi-select and the active tab's implicit categories have an empty
 * intersection (e.g. "casa" on the "terreno" tab), so the query returns an
 * empty list instead of silently showing the whole tab.
 */
const NO_MATCH_CATEGORIES = ["__no_match__"] as unknown as PropertyCategory[];

/**
 * Effective categories for a tab: the user's selection intersected with the
 * tab's implicit categories. With no user selection the tab's implicit set
 * applies; tabs without implicit categories pass the user's selection through.
 */
export function tabCategories(
  tab: InvestorTab,
  user: PropertyCategory[],
): PropertyCategory[] | undefined {
  const implicit = TAB_CATEGORIES[tab];
  if (user.length === 0) return implicit;
  if (!implicit) return user;
  const intersection = user.filter((c) => implicit.includes(c));
  return intersection.length > 0 ? intersection : NO_MATCH_CATEGORIES;
}

/**
 * Each opportunity tab maps to an explicit deal_type filter. Property-type
 * categories come from the user's multi-select, intersected with the tab's
 * implicit set, so results and per-tab badges always agree with the current
 * selection.
 */
export function tabToFilters(
  baseFilters: Omit<SearchFilters, "limit" | "sortBy">,
  selectedCategories: PropertyCategory[],
): Record<InvestorTab, Omit<SearchFilters, "limit" | "sortBy">> {
  return {
    todos: {
      ...baseFilters,
      categories: tabCategories("todos", selectedCategories),
    },
    remate: {
      ...baseFilters,
      dealType: "remate_bancario" as PropertyDealType,
      categories: tabCategories("remate", selectedCategories),
    },
    flipping: {
      ...baseFilters,
      dealType: "flipping" as PropertyDealType,
      categories: tabCategories("flipping", selectedCategories),
    },
    traspaso: {
      ...baseFilters,
      dealType: "traspaso" as PropertyDealType,
      categories: tabCategories("traspaso", selectedCategories),
    },
    comercial: {
      ...baseFilters,
      categories: tabCategories("comercial", selectedCategories),
    },
    terreno: {
      ...baseFilters,
      categories: tabCategories("terreno", selectedCategories),
    },
  };
}
