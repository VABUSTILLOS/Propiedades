"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import type { PropertiesRow } from "@/modules/lib/database.types";
import { PropertyCard } from "@/modules/home/components/property-card";

export type CityListingGroup = {
  /** Key for the "Todas" tab. */
  all: PropertiesRow[];
  /** City name → listings. */
  byCity: Record<string, PropertiesRow[]>;
};

/**
 * Featured listings with city tabs (Bali Listings pattern, adapted to the
 * Mexican cities present in the database). Tabs render an animated
 * underline via framer-motion layoutId; switching swaps the grid.
 */
export function FeaturedListings({
  groups,
  savedIds,
}: {
  groups: CityListingGroup;
  savedIds?: Set<string>;
}) {
  const cityNames = Object.keys(groups.byCity);
  const [activeCity, setActiveCity] = useState<string>("Todas");

  const listings = useMemo(
    () =>
      activeCity === "Todas"
        ? groups.all
        : groups.byCity[activeCity] ?? [],
    [activeCity, groups],
  );

  const tabs = ["Todas", ...cityNames];

  return (
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

        <div
          role="tablist"
          aria-label="Filtrar por ciudad"
          className="mb-8 flex flex-wrap gap-1"
        >
          {tabs.map((city) => {
            const active = activeCity === city;
            return (
              <button
                key={city}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveCity(city)}
                className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "text-[#C4571D]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {city}
                {active && (
                  <motion.span
                    layoutId="city-tab-underline"
                    className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-[#D67E3C] to-[#C4571D]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <motion.div
          key={activeCity}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {listings.map((listing) => (
            <PropertyCard
              key={listing.id}
              listing={listing}
              saved={savedIds?.has(listing.id) ?? false}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
