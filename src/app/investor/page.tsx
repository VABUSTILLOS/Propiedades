import type { Metadata } from "next";

import {
  countActiveListings,
  searchListings,
  type SearchFilters,
} from "@/modules/search/queries";
import { getBenchmark, getColoniaDiscount, toHotScore } from "@/modules/market-data/queries";
import { InvestorDashboardClient } from "@/modules/market-data/components/investor-dashboard-client";
import { investorParamsSchema, type InvestorTab } from "@/modules/lib/schemas";
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

export default async function InvestorPage({ searchParams }: Props) {
  const raw = await searchParams;
  const parsed = investorParamsSchema.safeParse(raw);
  const activeTab: InvestorTab = parsed.data?.tab ?? "todos";

  const baseFilters: Omit<SearchFilters, "limit" | "sortBy"> = {};

  // Each opportunity tab maps to explicit deal_type/category filters so the
  // dashboard reflects real data-model categories, not score heuristics.
  const tabToFilters: Record<InvestorTab, Omit<SearchFilters, "limit" | "sortBy">> = {
    todos: baseFilters,
    remate: { ...baseFilters, dealType: "remate_bancario" },
    flipping: { ...baseFilters, dealType: "flipping" },
    traspaso: { ...baseFilters, dealType: "traspaso" },
    comercial: { ...baseFilters, categories: ["local", "bodega"] },
    terreno: { ...baseFilters, category: "terreno" },
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
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Modo inversionista</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} {TAB_LABELS[activeTab]} en el catálogo
          </p>
        </div>
      </div>

      <InvestorDashboardClient
        items={items}
        activeTab={activeTab}
        counts={countByTab}
      />
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
    costoReparacion: p.costo_reparacion_estimado,
    valorPostReparacion: p.valor_post_reparacion_estimado,
    institucionBancaria: p.institucion_bancaria,
    fechaRemate: p.fecha_remate,
    condicionesTraspaso: p.condiciones_traspaso,
    capRate: p.cap_rate_projected,
    rentaEstimada: p.estimated_monthly_rent,
  };
}
