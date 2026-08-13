"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ListingWithHot } from "@/modules/search/queries";
import { SearchResultCard } from "@/modules/maps/components/search-result-card";
import { PropertyCard } from "@/modules/home/components/property-card";
import { CardDetailsToggle } from "@/modules/maps/components/card-details-toggle";

type ApiResponse = {
  items: ListingWithHot[];
  total: number;
};

const CARD_DETAILS_KEY = "cardShowDetails";

const cardDetailsListeners = new Set<() => void>();

function emitCardDetailsChange(): void {
  for (const listener of cardDetailsListeners) listener();
}

function subscribeCardDetails(callback: () => void): () => void {
  cardDetailsListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    cardDetailsListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getCardDetailsSnapshot(): boolean {
  try {
    return localStorage.getItem(CARD_DETAILS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Server render always shows the compact card (details opt-in per user). */
function getCardDetailsServerSnapshot(): boolean {
  return false;
}

/** Persists the pref and notifies subscribers in this tab (and others). */
function setCardDetailsPref(next: boolean): void {
  try {
    localStorage.setItem(CARD_DETAILS_KEY, next ? "1" : "0");
  } catch {
    // ignore write failures (storage full / private mode)
  }
  emitCardDetailsChange();
}

/**
 * Whether the extra financial details (predial, escrituración, barra hot,
 * $/m², % descuento) are visible on the cards. Backed by localStorage via
 * useSyncExternalStore so it persists across navigation and remounts without
 * hydration mismatches or setState-in-effect warnings.
 */
function useCardDetailsPref(): boolean {
  return useSyncExternalStore(
    subscribeCardDetails,
    getCardDetailsSnapshot,
    getCardDetailsServerSnapshot,
  );
}

/**
 * Real infinite scroll over `GET /api/search`.
 *
 * The parent remounts this with a `key` derived from the current filters
 * (including bounds), so navigating resets the list; the IntersectionObserver
 * plus the "Cargar más" button both pull the next `pageSize` rows.
 */
export function InfiniteListings({
  initialItems,
  initialTotal,
  filtersQueryString,
  card = "search",
  pageSize = 12,
  gridClassName = "grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3",
  emptyState,
  onCardHover,
}: {
  initialItems: ListingWithHot[];
  initialTotal: number;
  /** Current filters (and bounds) as a URL query string, no leading `?`. */
  filtersQueryString: string;
  /** Which card to render for each listing (serializable across RSC). */
  card?: "search" | "property";
  pageSize?: number;
  gridClassName?: string;
  emptyState?: React.ReactNode;
  /** Reports the id of the hovered card (null when leaving) — for map pin sync. */
  onCardHover?: (id: string | null) => void;
}) {
  const [items, setItems] = useState<ListingWithHot[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const showDetails = useCardDetailsPref();

  const toggleDetails = (next: boolean) => setCardDetailsPref(next);

  // The parent remounts this component with a `key` derived from the current
  // filters/bounds, so state always starts from the latest server render.
  const hasMore = items.length < total;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const qs = filtersQueryString
        ? `${filtersQueryString}&offset=${items.length}&limit=${pageSize}`
        : `offset=${items.length}&limit=${pageSize}`;
      const res = await fetch(`/api/search?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudieron cargar más propiedades.");
      const data = (await res.json()) as ApiResponse;
      const next = data.items ?? [];
      setItems((prev) => [...prev, ...next]);
      if (typeof data.total === "number") setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar más propiedades.");
    } finally {
      setLoading(false);
    }
  }, [filtersQueryString, loading, hasMore, pageSize, items.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  if (items.length === 0) {
    return (
      emptyState ?? (
        <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No hay propiedades que coincidan con tu búsqueda.
          </p>
        </div>
      )
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CardDetailsToggle show={showDetails} onChange={toggleDetails} />
      </div>

      <div className={gridClassName}>
        {items.map((item) => (
          <div
            key={item.id}
            onMouseEnter={() => onCardHover?.(item.id)}
            onMouseLeave={() => onCardHover?.(null)}
          >
            {card === "property" ? (
              <PropertyCard
                key={item.id}
                listing={item}
                hotScore={item.hotScore}
                discountPct={item.discountPct}
                showDetails={showDetails}
              />
            ) : (
              <SearchResultCard
                key={item.id}
                title={item.title}
                slug={item.slug}
                city={`${item.colonia}, ${item.city}`}
                price={item.price}
                currency={item.currency}
                type={item.type}
                image={item.images?.[0] ?? null}
                score={item.property_score}
                hotScore={item.hotScore}
                discountPct={item.discountPct}
                construccionM2={item.construccion_m2}
                terrenoM2={item.terreno_m2}
                showDetails={showDetails}
              />
            )}
          </div>
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center pt-2">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void loadMore()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                Cargando…
              </>
            ) : (
              "Cargar más"
            )}
          </Button>
        </div>
      )}

      {error && (
        <p className="text-center text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {!hasMore && (
        <p className="pb-4 text-center text-sm text-muted-foreground">
          Mostrando todas las {total} propiedades.
        </p>
      )}
    </div>
  );
}
