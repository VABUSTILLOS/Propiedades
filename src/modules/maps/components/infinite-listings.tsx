"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ListingWithHot } from "@/modules/search/queries";

type ApiResponse = {
  items: ListingWithHot[];
  total: number;
};

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
  renderCard,
  pageSize = 12,
  gridClassName = "grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3",
  emptyState,
}: {
  initialItems: ListingWithHot[];
  initialTotal: number;
  /** Current filters (and bounds) as a URL query string, no leading `?`. */
  filtersQueryString: string;
  renderCard: (item: ListingWithHot) => React.ReactNode;
  pageSize?: number;
  gridClassName?: string;
  emptyState?: React.ReactNode;
}) {
  const [items, setItems] = useState<ListingWithHot[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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
      <div className={gridClassName}>{items.map(renderCard)}</div>

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
