import type { Metadata } from "next";
import { TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  countActiveListings,
  searchListings,
  type SearchFilters,
} from "@/modules/search/queries";
import { getBenchmark, getColoniaDiscount, toHotScore } from "@/modules/market-data/queries";
import { InvestorDashboardClient } from "@/modules/market-data/components/investor-dashboard-client";
import {
  investorParamsSchema,
  parseBoundsString,
  parseCategoriesParam,
  type InvestorTab,
  type MapBounds,
} from "@/modules/lib/schemas";
import type {
  PropertiesRow,
  MarketBenchmarksRow,
  PropertyCategory,
  PropertyDealType,
} from "@/modules/lib/database.types";

export const metadata: Metadata = { title: "Modo inversionista" };
export const dynamic = "force-dynamic";

export type InvestorItem = {
  id: string;
  slug: string;
  title: string;
  city: string;
  colonia: string;
  category: PropertyCategory;
  dealType: PropertyDealType;
  price: number;
  currency: string;
  construccion_m2: number;
  terreno_m2: number;
  precio_m2_const: number | null;
  precio_m2_terreno: number | null;
  discountPct: number | null;
  discountAvaluo: number | null;
  benchmarkConst: number | null;
  benchmarkLand: number | null;
  hotScore: number | null;
  image: string | null;
  lat: number;
  lng: number;
  recamaras: number | null;
  // Investment-specific financial fields.
  costoReparacion: number | null;
  valorPostReparacion: number | null;
  institucionBancaria: string | null;
  fechaRemate: string | null;
  condicionesTraspaso: string | null;
  capRate: number | null;
  rentaEstimada: number | null;
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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
function tabCategories(
  tab: InvestorTab,
  user: PropertyCategory[],
): PropertyCategory[] | undefined {
  const implicit = TAB_CATEGORIES[tab];
  if (user.length === 0) return implicit;
  if (!implicit) return user;
  const intersection = user.filter((c) => implicit.includes(c));
  return intersection.length > 0 ? intersection : NO_MATCH_CATEGORIES;
}

export default async function InvestorPage({ searchParams }: Props) {
  const raw = await searchParams;
  const parsed = investorParamsSchema.safeParse(raw);
  const activeTab: InvestorTab = parsed.data?.tab ?? "todos";
  const bounds: MapBounds | null = parsed.data?.bounds
    ? (parseBoundsString(parsed.data.bounds) ?? null)
    : null;
  const mapSearch = parsed.data?.mapSearch === "true";

  // Property types chosen by the user (`categories` CSV) — intersected with
  // each tab's implicit categories below.
  const selectedCategories = parseCategoriesParam(parsed.data?.categories);

  const baseFilters: Omit<SearchFilters, "limit" | "sortBy"> = {};

  // Each opportunity tab maps to an explicit deal_type filter. Property-type
  // categories come from the user's multi-select, intersected with the tab's
  // implicit set, so results and per-tab badges always agree with the current
  // selection.
  const tabToFilters: Record<InvestorTab, Omit<SearchFilters, "limit" | "sortBy">> = {
    todos: {
      ...baseFilters,
      categories: tabCategories("todos", selectedCategories),
    },
    remate: {
      ...baseFilters,
      dealType: "remate_bancario",
      categories: tabCategories("remate", selectedCategories),
    },
    flipping: {
      ...baseFilters,
      dealType: "flipping",
      categories: tabCategories("flipping", selectedCategories),
    },
    traspaso: {
      ...baseFilters,
      dealType: "traspaso",
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

  const filters: SearchFilters = {
    ...tabToFilters[activeTab],
    sortBy: "newest",
    limit: 100,
  };

  const [listings, counts] = await Promise.all([
    searchListings(filters),
    Promise.all([
      countActiveListings(tabToFilters.todos),
      countActiveListings(tabToFilters.remate),
      countActiveListings(tabToFilters.flipping),
      countActiveListings(tabToFilters.traspaso),
      countActiveListings(tabToFilters.comercial),
      countActiveListings(tabToFilters.terreno),
    ]),
  ]);

  const countByTab: Record<InvestorTab, number> = {
    todos: counts[0],
    remate: counts[1],
    flipping: counts[2],
    traspaso: counts[3],
    comercial: counts[4],
    terreno: counts[5],
  };

  const items: InvestorItem[] = await Promise.all(
    listings.map(async (p): Promise<InvestorItem> => {
      const [benchmark, discountPct] = await Promise.all([
        p.city && p.colonia ? getBenchmark(p.city, p.colonia) : null,
        getColoniaDiscount(p.id),
      ]);
      return toInvestorItem(p, benchmark, discountPct);
    }),
  );

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <PageHeader
          eyebrow="Invertir"
          icon={TrendingUp}
          title="Modo inversionista"
          description={`${items.length} ${TAB_LABELS[activeTab]} en el catálogo`}
          className="mb-8"
        />

        <InvestorDashboardClient
          items={items}
          activeTab={activeTab}
          counts={countByTab}
          initialView={mapSearch ? "map" : "list"}
          initialBounds={bounds}
        />
      </main>
    </div>
  );
}

function toInvestorItem(
  p: PropertiesRow,
  benchmark: MarketBenchmarksRow | null,
  discountPct: number | null,
): InvestorItem {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    city: p.city,
    colonia: p.colonia,
    category: p.category,
    dealType: p.deal_type,
    price: p.price,
    currency: p.currency,
    construccion_m2: p.construccion_m2,
    terreno_m2: p.terreno_m2,
    precio_m2_const: p.precio_m2_const,
    precio_m2_terreno: p.precio_m2_terreno,
    discountPct,
    discountAvaluo: p.porcentaje_descuento_avaluo,
    benchmarkConst:
      benchmark?.avg_price_m2_const != null
        ? Math.round(benchmark.avg_price_m2_const)
        : null,
    benchmarkLand:
      benchmark?.avg_price_m2_land != null
        ? Math.round(benchmark.avg_price_m2_land)
        : null,
    hotScore: toHotScore(discountPct, p),
    image: p.images?.[0] ?? null,
    lat: p.lat,
    lng: p.lng,
    recamaras: p.recamaras,
    costoReparacion: p.costo_reparacion_estimado,
    valorPostReparacion: p.valor_post_reparacion_estimado,
    institucionBancaria: p.institucion_bancaria,
    fechaRemate: p.fecha_remate,
    condicionesTraspaso: p.condiciones_traspaso,
    capRate: p.cap_rate_projected,
    rentaEstimada: p.estimated_monthly_rent,
  };
}
