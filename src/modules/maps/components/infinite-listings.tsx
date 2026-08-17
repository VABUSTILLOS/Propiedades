"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, CheckSquare, Loader2, Square, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ListingWithHot } from "@/modules/search/queries";
import { SearchResultCard } from "@/modules/maps/components/search-result-card";
import { PropertyCard } from "@/modules/home/components/property-card";
import { CardDetailsToggle } from "@/modules/maps/components/card-details-toggle";
import { bulkModerateProperties } from "@/modules/admin/actions";

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
  onCardSelect,
  from,
  canModerate = false,
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
  /** Called when a card is clicked instead of navigating (split detail pane). */
  onCardSelect?: (item: ListingWithHot) => void;
  /** Full URL of the current list/search view, passed on so the detail page
   *  can link back to it. */
  from?: string;
  /** Master user (admin): enables multi-select + bulk archive/delete. */
  canModerate?: boolean;
}) {
  const [items, setItems] = useState<ListingWithHot[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
      setItems((prev) => prev.filter((item) => !selected.has(item.id)));
      setTotal((prev) => Math.max(0, prev - selected.size));
      setSelected(new Set());
      setSelecting(false);
      router.refresh();
    });
  };

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
      <div className="flex items-center justify-end gap-2">
        {canModerate && (
          <Button
            variant={selecting ? "default" : "outline"}
            size="sm"
            onClick={toggleSelecting}
          >
            {selecting ? "Cancelar selección" : "Seleccionar"}
          </Button>
        )}
        <CardDetailsToggle show={showDetails} onChange={toggleDetails} />
      </div>

      <div className={gridClassName}>
        {items.map((item) => (
          <div
            key={item.id}
            className={
              selecting
                ? selected.has(item.id)
                  ? "relative rounded-2xl ring-2 ring-primary"
                  : "relative"
                : undefined
            }
            onMouseEnter={() => onCardHover?.(item.id)}
            onMouseLeave={() => onCardHover?.(null)}
            onClickCapture={
              selecting
                ? (e) => {
                    // Selection mode: clicking a card toggles its checkbox
                    // instead of navigating. Interactive children (favorite
                    // bookmark, …) keep their own behavior.
                    const target = e.target as Element | null;
                    if (target && typeof target.closest === "function") {
                      if (
                        target.closest(
                          "button, [role='button'], input, select, textarea",
                        )
                      ) {
                        return;
                      }
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSelected(item.id);
                  }
                : onCardSelect
                  ? (e) => {
                    // Split view: select the card and let the map zoom to the
                    // property instead of navigating to its listing page. The
                    // capture phase runs before next/link's own click handler,
                    // so this actually cancels the navigation (a preventDefault
                    // in the bubble phase arrives too late).
                    const isModified =
                      e.metaKey ||
                      e.ctrlKey ||
                      e.shiftKey ||
                      e.altKey ||
                      e.nativeEvent?.button === 1;
                    if (isModified) return;
                    const target = e.target as Element | null;
                    if (target && typeof target.closest === "function") {
                      // Interactive children (favorite bookmark, …) keep their
                      // own behavior.
                      if (
                        target.closest(
                          "button, [role='button'], input, select, textarea",
                        )
                      ) {
                        return;
                      }
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    onCardSelect(item);
                  }
                : undefined
            }
          >
            {selecting && (
              <span
                className="absolute left-2 top-2 z-20 rounded-full bg-background/90 p-1 text-primary shadow"
                aria-hidden="true"
              >
                {selected.has(item.id) ? (
                  <CheckSquare className="size-5" />
                ) : (
                  <Square className="size-5" />
                )}
              </span>
            )}
            {card === "property" ? (
              <PropertyCard
                key={item.id}
                listing={item}
                hotScore={item.hotScore}
                discountPct={item.discountPct}
                showDetails={showDetails}
                from={from}
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
                videoUrl={
                  item.video_url ??
                  item.generated_video_url ??
                  item.generated_video_vertical_url
                }
                score={item.property_score}
                hotScore={item.hotScore}
                discountPct={item.discountPct}
                construccionM2={item.construccion_m2}
                terrenoM2={item.terreno_m2}
                showDetails={showDetails}
                from={from}
                dealType={item.deal_type}
                investmentKpis={{
                  dealType: item.deal_type,
                  price: item.price,
                  costoReparacion: item.costo_reparacion_estimado,
                  valorPostReparacion: item.valor_post_reparacion_estimado,
                  institucionBancaria: item.institucion_bancaria,
                  fechaRemate: item.fecha_remate,
                  condicionesTraspaso: item.condiciones_traspaso,
                  capRate: item.cap_rate_projected,
                  rentaEstimada: item.estimated_monthly_rent,
                  discountAvaluo: item.porcentaje_descuento_avaluo,
                }}
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

      {moderationError && (
        <p className="text-center text-sm text-destructive" role="alert">
          {moderationError}
        </p>
      )}

      {selecting && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-full border bg-background px-5 py-3 shadow-xl">
          <span className="text-sm font-medium">
            {selected.size}{" "}
            {selected.size === 1 ? "seleccionada" : "seleccionadas"}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={moderating}
            onClick={() => moderate("archive")}
          >
            <Archive className="size-4" />
            Archivar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={moderating}
            onClick={() => moderate("delete")}
          >
            <Trash2 className="size-4" />
            Borrar
          </Button>
          {moderating && <Loader2 className="size-4 animate-spin" />}
        </div>
      )}

      {!hasMore && (
        <p className="pb-4 text-center text-sm text-muted-foreground">
          Mostrando todas las {total} propiedades.
        </p>
      )}
    </div>
  );
}
