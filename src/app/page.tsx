import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/modules/auth/session";
import {
  getFeaturedListings,
  getFeaturedListingsByCity,
  getHomepageStats,
  getNewThisWeekCount,
  getSavedPropertyIds,
  getTopOpportunities,
} from "@/modules/home/queries";
import { formatMxn } from "@/modules/lib/real-estate";
import { HeroSearch } from "@/modules/home/components/hero-search";
import { HeroDealCard } from "@/modules/home/components/hero-deal-card";
import { MarketTicker } from "@/modules/home/components/market-ticker";
import { OpportunityLedger } from "@/modules/home/components/opportunity-ledger";
import { DataEdgeSection } from "@/modules/home/components/data-edge-section";
import { SelectionMethodSection } from "@/modules/home/components/selection-method";
import { ChatAssistantSection } from "@/modules/chat/components/chat-assistant-section";
import { SiteFooter } from "@/modules/home/components/site-footer";
import { FeaturedListings } from "@/modules/home/components/featured-listings";
import { StatsSection } from "@/modules/home/components/stats-section";
import { SellerCtaSection } from "@/modules/home/components/seller-cta";
import { TestimonialsSection } from "@/modules/home/components/testimonials-section";

export const metadata: Metadata = { title: "Inicio" };

export const dynamic = "force-dynamic";

const FEATURED_CITY_COUNT = 4;

export default async function HomePage() {
  const [user, stats, listings, opportunities, newThisWeek] = await Promise.all([
    getCurrentUser(),
    getHomepageStats(),
    getFeaturedListings(6),
    getTopOpportunities(8),
    getNewThisWeekCount(),
  ]);

  const topCities = stats.cities.slice(0, 3);
  const cityNames = stats.cities.map((city) => city.name);
  const savedIds = await getSavedPropertyIds(user?.id ?? null);

  // Fetch featured listings per top city for the city-tabbed grid.
  const featuredByCity: Record<string, Awaited<ReturnType<typeof getFeaturedListingsByCity>>> =
    {};
  if (stats.cities.length > 0) {
    const cityResults = await Promise.all(
      stats.cities.slice(0, FEATURED_CITY_COUNT).map((city) =>
        getFeaturedListingsByCity(city.name, 6).then((rows) => ({
          name: city.name,
          rows,
        })),
      ),
    );
    for (const { name, rows } of cityResults) {
      if (rows.length > 0) {
        featuredByCity[name] = rows;
      }
    }
  }

  const topDeal = opportunities[0] ?? null;

  // Average advantage vs colonia across the ranked opportunities — the
  // "ahorro promedio detectado" pulse stat.
  const discounts = opportunities
    .map((item) => item.discountPct)
    .filter((value): value is number => value != null && value > 0);
  const avgDiscount =
    discounts.length > 0
      ? discounts.reduce((sum, value) => sum + value, 0) / discounts.length
      : null;

  const pulseStats = [
    {
      value: stats.activeCount.toLocaleString("es-MX"),
      label: "Oportunidades activas",
    },
    {
      value: `+${newThisWeek.toLocaleString("es-MX")}`,
      label: "Nuevas esta semana",
    },
    ...(avgDiscount != null
      ? [{ value: `−${avgDiscount.toFixed(1)}%`, label: "Ahorro promedio vs colonia" }]
      : []),
    {
      value: stats.cities.length.toLocaleString("es-MX"),
      label: "Ciudades cubiertas",
    },
  ];

  const tickerItems = opportunities.slice(0, 8).map((item) => {
    const place =
      [item.colonia, item.city].filter(Boolean).join(" · ") || "México";
    const delta =
      item.discountPct != null && item.discountPct > 0
        ? `−${item.discountPct.toFixed(0)}% vs colonia`
        : formatMxn(item.price);
    return `${item.title} — ${place} — ${delta}`;
  });

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        {/* Hero — registro de oportunidades */}
        <section className="relative overflow-hidden bg-[#180F08] text-[#FBF6F0]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(rgba(251,246,240,0.055) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              maskImage:
                "radial-gradient(ellipse 90% 80% at 30% 10%, black 30%, transparent 75%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 90% 80% at 30% 10%, black 30%, transparent 75%)",
            }}
          />
          <div className="relative mx-auto w-full max-w-6xl px-6 pb-14 pt-16 sm:pt-24">
            <div className="grid items-center gap-12 lg:grid-cols-[1.25fr_1fr]">
              <div>
                <span className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#7BC796] opacity-70" />
                    <span className="relative inline-flex size-2 rounded-full bg-[#7BC796]" />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/70">
                    {newThisWeek > 0
                      ? `Registro activo — ${newThisWeek} nuevas esta semana`
                      : "Registro activo — actualizado hoy"}
                  </span>
                </span>

                <h1 className="mt-6 max-w-xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl lg:leading-[1.04]">
                  No listamos todo. Solo lo que{" "}
                  <em className="font-display italic">vale la pena</em>.
                </h1>
                <p className="mt-5 max-w-xl text-lg text-white/65">
                  Analizamos cada propiedad contra el benchmark de su colonia y
                  publicamos únicamente las que superan al mercado — con el
                  descuento, los costos de cierre y la renta potencial a la vista.
                </p>

                <div className="mt-8 w-full max-w-2xl">
                  <HeroSearch cities={cityNames} />
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
                  {topCities.length > 0 ? (
                    topCities.map((city) => (
                      <Link
                        key={city.name}
                        href={`/search?city=${encodeURIComponent(city.name)}`}
                        className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 font-medium text-white/85 transition-colors hover:bg-white/15 hover:text-white"
                      >
                        {city.name}
                      </Link>
                    ))
                  ) : (
                    <Link
                      href="/search"
                      className="font-medium text-white/80 underline-offset-4 hover:underline"
                    >
                      Explora el registro completo →
                    </Link>
                  )}
                  <span className="hidden text-white/25 sm:inline">·</span>
                  <span className="font-mono text-xs text-white/45">
                    Sin comisiones ocultas · Ofertas digitales 24/7
                  </span>
                </div>
              </div>

              {topDeal && (
                <div className="relative mx-auto w-full max-w-md lg:max-w-none">
                  <div
                    aria-hidden
                    className="absolute -inset-3 rotate-2 rounded-[2rem] border border-white/10"
                  />
                  <HeroDealCard listing={topDeal} />
                </div>
              )}
            </div>

            {/* Pulso del mercado — prueba social en vivo */}
            <dl className="mt-14 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-white/10 pt-8 sm:grid-cols-4">
              {pulseStats.map((stat) => (
                <div key={stat.label}>
                  <dd className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
                    {stat.value}
                  </dd>
                  <dt className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-white/50">
                    {stat.label}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <MarketTicker items={tickerItems} />

        <OpportunityLedger items={opportunities} />

        <DataEdgeSection />

        <ChatAssistantSection />

        {listings.length > 0 && (
          <FeaturedListings
            groups={{
              all: listings,
              byCity: featuredByCity,
            }}
            savedIds={savedIds}
          />
        )}

        <SelectionMethodSection />

        <TestimonialsSection />

        <StatsSection stats={stats} />

        <SellerCtaSection user={user} />
      </main>

      <SiteFooter />
    </div>
  );
}
