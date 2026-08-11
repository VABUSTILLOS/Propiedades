import type { Metadata } from "next";
import Link from "next/link";

import { searchListings } from "@/modules/search/queries";
import { getBenchmark, getColoniaDiscount } from "@/modules/market-data/queries";
import { InvestorDashboardClient } from "@/modules/market-data/components/investor-dashboard-client";
import type { PropertiesRow, MarketBenchmarksRow } from "@/modules/lib/database.types";

export const metadata: Metadata = { title: "Modo inversionista" };
export const dynamic = "force-dynamic";

export type InvestorItem = {
  id: string;
  slug: string;
  title: string;
  city: string;
  colonia: string;
  price: number;
  currency: string;
  construccion_m2: number;
  terreno_m2: number;
  precio_m2_const: number | null;
  precio_m2_terreno: number | null;
  discountPct: number | null;
  benchmarkConst: number | null;
  benchmarkLand: number | null;
  image: string | null;
};

export default async function InvestorPage() {
  // Pull all active listings and compute financial metrics per row.
  const listings = await searchListings({ limit: 100, sortBy: "newest" });

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
            Filtra por $/m², descuento sobre avalúo y ahorro vs. la colonia.
          </p>
        </div>
        <Link href="/search" className="text-sm text-primary hover:underline">
          ← Volver a búsqueda
        </Link>
      </div>

      <InvestorDashboardClient items={items} />
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
    price: p.price,
    currency: p.currency,
    construccion_m2: p.construccion_m2,
    terreno_m2: p.terreno_m2,
    precio_m2_const: p.precio_m2_const,
    precio_m2_terreno: p.precio_m2_terreno,
    discountPct,
    benchmarkConst:
      benchmark?.avg_price_m2_const != null
        ? Math.round(benchmark.avg_price_m2_const)
        : null,
    benchmarkLand:
      benchmark?.avg_price_m2_land != null
        ? Math.round(benchmark.avg_price_m2_land)
        : null,
    image: p.images?.[0] ?? null,
  };
}
