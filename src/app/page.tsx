import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/modules/auth/session";
import {
  getFeaturedListings,
  getHomepageStats,
} from "@/modules/home/queries";
import { HeroSearch } from "@/modules/home/components/hero-search";
import { SiteHeader } from "@/modules/home/components/site-header";
import { SiteFooter } from "@/modules/home/components/site-footer";
import { PropertyCard } from "@/modules/home/components/property-card";
import { ExploreSection } from "@/modules/home/components/explore-section";
import { HowItWorksSection } from "@/modules/home/components/how-it-works";
import { StatsSection } from "@/modules/home/components/stats-section";
import { SellerCtaSection } from "@/modules/home/components/seller-cta";

export const metadata: Metadata = { title: "Inicio" };

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [user, stats, listings] = await Promise.all([
    getCurrentUser(),
    getHomepageStats(),
    getFeaturedListings(6),
  ]);

  const cityNames = stats.cities.map((city) => city.name);
  const topCities = stats.cities.slice(0, 3);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={user} />

      <main className="flex-1">
        {/* Hero + búsqueda */}
        <section className="relative overflow-hidden bg-[var(--brand)] text-[var(--brand-foreground)]">
          <div className="absolute inset-0 bg-[radial-gradient(1100px_420px_at_50%_-12%,rgba(255,255,255,0.16),transparent)]" />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-6 py-20 text-center sm:py-28">
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Encuentra tu próxima propiedad en México
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-white/70">
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
                    className="rounded-full border border-white/25 px-3 py-1 font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
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
              <span className="text-white/60">
                Sin comisiones ocultas · Tours por WhatsApp · Ofertas 24/7
              </span>
            </div>
          </div>
        </section>

        <ExploreSection cities={stats.cities} />

        {listings.length > 0 && (
          <section className="border-t bg-muted/50">
            <div className="mx-auto w-full max-w-6xl px-6 py-16">
              <div className="mb-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Propiedades destacadas
                  </h2>
                  <p className="mt-1 text-muted-foreground">
                    Lo más reciente del mercado, listo para explorar.
                  </p>
                </div>
                <Link
                  href="/search"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Ver todas las propiedades →
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((listing) => (
                  <PropertyCard key={listing.id} listing={listing} />
                ))}
              </div>
            </div>
          </section>
        )}

        <HowItWorksSection />

        <StatsSection stats={stats} />

        <SellerCtaSection user={user} />
      </main>

      <SiteFooter />
    </div>
  );
}
