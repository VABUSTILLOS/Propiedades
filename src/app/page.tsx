import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/modules/auth/session";
import {
  getFeaturedListings,
  getFeaturedListingsByCity,
  getHomepageStats,
  getSavedPropertyIds,
  getTopRatedListings,
} from "@/modules/home/queries";
import { HeroSearch } from "@/modules/home/components/hero-search";
import { ChatAssistantSection } from "@/modules/chat/components/chat-assistant-section";
import { SiteHeader } from "@/modules/home/components/site-header";
import { SiteFooter } from "@/modules/home/components/site-footer";
import { PropertyCard } from "@/modules/home/components/property-card";
import { FeaturedListings } from "@/modules/home/components/featured-listings";
import { ExploreSection } from "@/modules/home/components/explore-section";
import { HowItWorksSection } from "@/modules/home/components/how-it-works";
import { StatsSection } from "@/modules/home/components/stats-section";
import { SellerCtaSection } from "@/modules/home/components/seller-cta";
import { TestimonialsSection } from "@/modules/home/components/testimonials-section";

export const metadata: Metadata = { title: "Inicio" };

export const dynamic = "force-dynamic";

const FEATURED_CITY_COUNT = 4;

export default async function HomePage() {
  const [user, stats, listings, topRated] = await Promise.all([
    getCurrentUser(),
    getHomepageStats(),
    getFeaturedListings(6),
    getTopRatedListings(6),
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

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={user} />

      <main className="flex-1">
        {/* Hero + búsqueda */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#D67E3C] via-[#C4571D] to-[#8F2E0F] text-white">
          <div className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -right-20 size-[28rem] rounded-full bg-[#6E1D00]/20 blur-3xl" />
          <div className="pointer-events-none absolute right-1/3 top-0 size-52 rounded-full bg-[#FFC892]/15 blur-2xl" />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-6 py-20 text-center sm:py-28">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
              Marketplace inmobiliario de México
            </span>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Encuentra tu próxima propiedad en{" "}
              <span className="bg-gradient-to-r from-[#FFD9A8] to-[#FFF3E6] bg-clip-text text-transparent">
                México
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-white/75">
              Casas, departamentos, terrenos e inversiones. Compara $/m², agenda
              tours y cierra con ofertas digitales — todo en un solo lugar.
            </p>

            <div className="mt-8 w-full max-w-3xl">
              <HeroSearch cities={cityNames} />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
              {topCities.length > 0 ? (
                topCities.map((city) => (
                  <Link
                    key={city.name}
                    href={`/search?city=${encodeURIComponent(city.name)}`}
                    className="rounded-full border border-white/30 bg-white/10 px-4 py-1.5 font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
                  >
                    {city.name}
                  </Link>
                ))
              ) : (
                <Link
                  href="/search"
                  className="font-medium text-white/80 underline-offset-4 hover:underline"
                >
                  Explora todas las propiedades →
                </Link>
              )}
              <span className="hidden text-white/40 sm:inline">·</span>
              <span className="text-white/65">
                Sin comisiones ocultas · Tours por WhatsApp · Ofertas 24/7
              </span>
            </div>
          </div>
        </section>

        <ExploreSection cities={stats.cities} />

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

        {topRated.length > 0 && (
          <section className="border-t bg-background">
            <div className="mx-auto w-full max-w-6xl px-6 py-16">
              <div className="mb-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Las mejor valoradas del mercado
                  </h2>
                  <p className="mt-1 text-muted-foreground">
                    Selección inteligente según análisis de calidad y precio
                    por $/m². Tu atajo a lo mejor de Propiedades.
                  </p>
                </div>
                <Link
                  href="/search?sortBy=score"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Ver ranking completo →
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {topRated.map((listing) => (
                  <PropertyCard
                    key={listing.id}
                    listing={listing}
                    saved={savedIds.has(listing.id)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        <HowItWorksSection />

        <TestimonialsSection />

        <StatsSection stats={stats} />

        <SellerCtaSection user={user} />
      </main>

      <SiteFooter />
    </div>
  );
}
