"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import type { PropertiesRow } from "@/modules/lib/database.types";
import { PropertyCard } from "@/modules/home/components/property-card";
import { handleTabListKeyDown } from "@/lib/a11y";
import { bulkModerateProperties } from "@/modules/admin/actions";
import {
  ModerationActionBar,
  ModerationToggleButton,
  SelectableCardShell,
} from "@/modules/admin/components/moderation-controls";
import { EditorModeToggle } from "@/modules/admin/components/editor-mode-toggle";

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
  canModerate = false,
  canEdit = false,
}: {
  groups: CityListingGroup;
  savedIds?: Set<string>;
  /** Master user (admin): enables multi-select + bulk archive/delete. */
  canModerate?: boolean;
  /** Master user (admin) with editor mode on: adds "Editar" pills on cards. */
  canEdit?: boolean;
}) {
  const cityNames = Object.keys(groups.byCity);
  const [activeCity, setActiveCity] = useState<string>("Todas");

  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [moderating, startModeration] = useTransition();
  const [moderationError, setModerationError] = useState<string | null>(null);

  const toggleSelecting = () => {
    setSelecting((prev) => !prev);
    setSelected(new Set());
    setModerationError(null);
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const moderate = (action: "archive" | "delete") => {
    const ids = [...selected];
    if (ids.length === 0) return;
    startModeration(async () => {
      setModerationError(null);
      const res = await bulkModerateProperties(ids, action);
      if (!res.ok) {
        setModerationError(res.error);
        return;
      }
      setHiddenIds((prev) => new Set([...prev, ...ids]));
      setSelected(new Set());
      setSelecting(false);
      router.refresh();
    });
  };

  const listings = useMemo(
    () =>
      (activeCity === "Todas"
        ? groups.all
        : groups.byCity[activeCity] ?? []
      ).filter((listing) => !hiddenIds.has(listing.id)),
    [activeCity, groups, hiddenIds],
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
          <div className="flex items-center gap-3">
            {canModerate && (
              <ModerationToggleButton
                selecting={selecting}
                onToggle={toggleSelecting}
              />
            )}
            {canEdit && <EditorModeToggle active />}
            <Link
              href="/search"
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver todas las propiedades →
            </Link>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Filtrar por ciudad"
          onKeyDown={handleTabListKeyDown}
          className="mb-8 flex flex-wrap gap-1"
        >
          {tabs.map((city) => {
            const active = activeCity === city;
            return (
              <button
                key={city}
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => setActiveCity(city)}
                className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {city}
                {active && (
                  <motion.span
                    layoutId="city-tab-underline"
                    className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-copper to-primary"
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
            <SelectableCardShell
              key={listing.id}
              selecting={selecting}
              selected={selected.has(listing.id)}
              onToggle={() => toggleSelected(listing.id)}
            >
              <PropertyCard
                listing={listing}
                saved={savedIds?.has(listing.id) ?? false}
                editHref={
                  canEdit ? `/admin/propiedades/${listing.id}/editar` : undefined
                }
              />
            </SelectableCardShell>
          ))}
        </motion.div>

        {moderationError && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {moderationError}
          </p>
        )}

        {selecting && (
          <ModerationActionBar
            count={selected.size}
            moderating={moderating}
            onAction={moderate}
          />
        )}
      </div>
    </section>
  );
}
