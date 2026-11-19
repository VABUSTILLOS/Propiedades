"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bath,
  BedDouble,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ImageOff,
  Import,
  Loader2,
  MapPin,
  RotateCcw,
  Ruler,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/layout/empty-state";
import { cn } from "@/lib/utils";
import type {
  MarketplaceListingStatus,
  MarketplaceSavedCategory,
  MarketplaceSavedListingsRow,
} from "@/modules/lib/database.types";
import {
  deleteImportedProperty,
  discardSavedListing,
  importSavedListing,
  restoreSavedListing,
} from "@/modules/guardados/actions";
import { SavedPhotosOrderEditor } from "@/modules/guardados/components/saved-photos-order-editor";

type View = "guardados" | "descartados";
type SortKey = "saved" | "price-asc" | "price-desc" | "date-desc" | "date-asc" | "name";
type TypeFilter = "all" | MarketplaceSavedCategory;
type StatusFilter = "all" | MarketplaceListingStatus;

const MENU_STORAGE_KEY = "guardados-marketplace-menu-open";

/** localStorage-backed menu preference, read without hydration mismatch. */
function subscribeMenuPreference(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function readMenuPreference(): boolean {
  try {
    return window.localStorage.getItem(MENU_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "propiedad", label: "Propiedades" },
  { value: "auto", label: "Autos" },
  { value: "tecnologia", label: "Tecnología" },
  { value: "otro", label: "Otros" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "Available", label: "Disponibles" },
  { value: "Sold", label: "Vendidos" },
  { value: "Rented", label: "Rentados" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "saved", label: "Orden guardado" },
  { value: "price-asc", label: "Precio: menor a mayor" },
  { value: "price-desc", label: "Precio: mayor a menor" },
  { value: "date-desc", label: "Publicación: más reciente" },
  { value: "date-asc", label: "Publicación: más antigua" },
  { value: "name", label: "Nombre (A–Z)" },
];

const LISTING_STATUS_LABEL: Record<MarketplaceListingStatus, string> = {
  Available: "Disponible",
  Sold: "Vendido",
  Rented: "Rentado",
};

const LISTING_STATUS_CLASS: Record<MarketplaceListingStatus, string> = {
  Available: "bg-emerald-600 text-white",
  Sold: "bg-red-600 text-white",
  Rented: "bg-amber-500 text-white",
};

const CATEGORY_LABEL: Record<MarketplaceSavedCategory, string> = {
  propiedad: "Propiedad",
  auto: "Auto",
  tecnologia: "Tecnología",
  otro: "Otro",
};

const priceFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(value);
}

type Feedback = {
  kind: "success" | "error";
  message: string;
  propertyId?: string;
  slug?: string;
};

export function GuardadosClient({
  listings,
}: {
  listings: MarketplaceSavedListingsRow[];
}) {
  const [rows, setRows] = useState(listings);
  const [view, setView] = useState<View>("guardados");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("saved");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // The collapsible controls menu remembers its state across visits
  // (Victor asked for it explicitly: the menu covers too much screen).
  const storedMenuOpen = useSyncExternalStore(
    subscribeMenuPreference,
    readMenuPreference,
    () => true,
  );
  const [menuOverride, setMenuOverride] = useState<boolean | null>(null);
  const menuOpen = menuOverride ?? storedMenuOpen;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [, startTransition] = useTransition();

  const toggleMenu = () => {
    const next = !menuOpen;
    setMenuOverride(next);
    try {
      window.localStorage.setItem(MENU_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Ignore persistence failures.
    }
  };

  const counts = useMemo(
    () => ({
      guardados: rows.filter((r) => r.status !== "discarded").length,
      descartados: rows.filter((r) => r.status === "discarded").length,
      pendingProperties: rows.filter(
        (r) => r.is_property && r.status === "active",
      ).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (view === "guardados" && row.status === "discarded") return false;
      if (view === "descartados" && row.status !== "discarded") return false;
      if (typeFilter !== "all" && row.category !== typeFilter) return false;
      if (statusFilter !== "all" && row.listing_status !== statusFilter) return false;
      if (q) {
        const haystack = [row.title, row.location, row.colonia, row.city]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const bySaved = (a: MarketplaceSavedListingsRow, b: MarketplaceSavedListingsRow) =>
      (a.saved_order ?? Number.MAX_SAFE_INTEGER) -
      (b.saved_order ?? Number.MAX_SAFE_INTEGER);

    switch (sort) {
      case "price-asc":
        return filtered.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      case "price-desc":
        return filtered.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      case "date-desc":
      case "date-asc": {
        const dir = sort === "date-desc" ? -1 : 1;
        return filtered.sort((a, b) => {
          const ta = a.listing_created_at ? Date.parse(a.listing_created_at) : 0;
          const tb = b.listing_created_at ? Date.parse(b.listing_created_at) : 0;
          return (ta - tb) * dir;
        });
      }
      case "name":
        return filtered.sort((a, b) => a.title.localeCompare(b.title, "es"));
      default:
        return filtered.sort(bySaved);
    }
  }, [rows, view, query, sort, typeFilter, statusFilter]);

  const runAction = (
    row: MarketplaceSavedListingsRow,
    action: () => Promise<{ ok: boolean; error?: string }>,
    onSuccess: () => void,
    successMessage: string,
  ) => {
    setPendingId(row.id);
    startTransition(async () => {
      const res = await action();
      setPendingId(null);
      if (!res.ok) {
        setFeedback((prev) => ({
          ...prev,
          [row.id]: {
            kind: "error",
            message: res.error ?? "Algo salió mal. Inténtalo de nuevo.",
          },
        }));
        return;
      }
      onSuccess();
      setFeedback((prev) => ({
        ...prev,
        [row.id]: { kind: "success", message: successMessage },
      }));
    });
  };

  const handleDiscard = (row: MarketplaceSavedListingsRow) =>
    runAction(
      row,
      () => discardSavedListing(row.id),
      () =>
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, status: "discarded" } : r)),
        ),
      "Publicación descartada. Puedes restaurarla desde Descartados.",
    );

  const handlePhotosReordered = (
    row: MarketplaceSavedListingsRow,
    photoUrls: string[],
  ) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? {
              ...r,
              photo_urls: photoUrls,
              primary_photo_url: photoUrls[0] ?? null,
            }
          : r,
      ),
    );
  };

  const handleRestore = (row: MarketplaceSavedListingsRow) =>
    runAction(
      row,
      () => restoreSavedListing(row.id),
      () =>
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, status: "active" } : r)),
        ),
      "Publicación restaurada.",
    );

  const handleImport = (row: MarketplaceSavedListingsRow) => {
    setPendingId(row.id);
    startTransition(async () => {
      const res = await importSavedListing(row.id);
      setPendingId(null);
      if (!res.ok) {
        setFeedback((prev) => ({
          ...prev,
          [row.id]: {
            kind: "error",
            message: res.error ?? "No se pudo importar la publicación.",
          },
        }));
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, status: "imported", imported_property_id: res.data.propertyId }
            : r,
        ),
      );
      setFeedback((prev) => ({
        ...prev,
        [row.id]: {
          kind: "success",
          message: `Publicada en ${res.data.section}.`,
          propertyId: res.data.propertyId,
          slug: res.data.slug,
        },
      }));
    });
  };

  const handleDeleteProperty = (row: MarketplaceSavedListingsRow) => {
    setPendingId(row.id);
    startTransition(async () => {
      const res = await deleteImportedProperty(row.id);
      setPendingId(null);
      if (!res.ok) {
        setFeedback((prev) => ({
          ...prev,
          [row.id]: {
            kind: "error",
            message: res.error ?? "No se pudo borrar la propiedad.",
          },
        }));
        return;
      }
      // The property is off the portal and out of this list for good.
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    });
  };

  return (
    <div>
      {/* Views */}
      <nav className="flex flex-wrap gap-2" aria-label="Vistas de guardados">
        {(
          [
            { value: "guardados", label: `Guardados (${counts.guardados})` },
            { value: "descartados", label: `Descartados (${counts.descartados})` },
          ] as { value: View; label: string }[]
        ).map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setView(tab.value)}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors",
              view === tab.value
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {tab.label}
          </button>
        ))}
        <span className="ml-auto hidden items-center text-sm text-muted-foreground sm:inline-flex">
          {counts.pendingProperties} propiedades sin importar
        </span>
      </nav>

      {/* Controls bar: the toggle stays visible even when collapsed. */}
      <div className="mt-4 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título, colonia o ciudad…"
              className="pl-9"
              aria-label="Buscar en guardados"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden md:inline">Ordenar</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 rounded-full border bg-background px-3 text-sm text-foreground"
              aria-label="Ordenar guardados"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={toggleMenu}
            aria-expanded={menuOpen}
            className="gap-1.5"
          >
            <SlidersHorizontal className="size-4" />
            Filtros
            {menuOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>

        {menuOpen && (
          <div className="mt-4 flex flex-col gap-3 border-t pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-sm font-medium text-muted-foreground">Tipo</span>
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTypeFilter(option.value)}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors",
                    typeFilter === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-sm font-medium text-muted-foreground">Estado</span>
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors",
                    statusFilter === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="mt-6">
        {visible.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            description={
              rows.length === 0
                ? "Todavía no hay publicaciones sincronizadas. Corre el script de sincronización para traer tus guardados de Marketplace."
                : view === "descartados"
                  ? "No hay publicaciones descartadas con estos filtros."
                  : "Ninguna publicación coincide con la búsqueda o los filtros."
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((row) => (
              <SavedListingCard
                key={row.id}
                row={row}
                pending={pendingId === row.id}
                feedback={feedback[row.id]}
                onDiscard={() => handleDiscard(row)}
                onRestore={() => handleRestore(row)}
                onImport={() => handleImport(row)}
                onDeleteProperty={() => handleDeleteProperty(row)}
                onPhotosReordered={(photoUrls) =>
                  handlePhotosReordered(row, photoUrls)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SavedListingCard({
  row,
  pending,
  feedback,
  onDiscard,
  onRestore,
  onImport,
  onDeleteProperty,
  onPhotosReordered,
}: {
  row: MarketplaceSavedListingsRow;
  pending: boolean;
  feedback?: Feedback;
  onDiscard: () => void;
  onRestore: () => void;
  onImport: () => void;
  onDeleteProperty: () => void;
  onPhotosReordered: (photoUrls: string[]) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const photo = row.primary_photo_url ?? row.photo_urls?.[0] ?? null;
  const photoCount = row.photo_urls?.length ?? 0;
  const locationLabel =
    row.location ?? [row.colonia, row.city].filter(Boolean).join(", ") ?? "";
  const marketplaceUrl =
    row.source_url ?? `https://www.facebook.com/marketplace/item/${row.listing_id}`;
  const imported = row.status === "imported";

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="relative aspect-[4/3] bg-muted">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={row.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <ImageOff className="size-8" aria-hidden />
          </span>
        )}
        {row.listing_status && (
          <span
            className={cn(
              "absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              LISTING_STATUS_CLASS[row.listing_status],
            )}
          >
            {LISTING_STATUS_LABEL[row.listing_status]}
          </span>
        )}
        {photoCount > 1 && (
          <span className="absolute right-2 bottom-2 rounded-full bg-black/70 px-2.5 py-0.5 text-xs font-medium text-white">
            {photoCount} fotos
          </span>
        )}
        {imported && (
          <span className="absolute bottom-2 left-2 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            Importada
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-lg font-bold tracking-tight">
          {row.price !== null ? priceFormatter.format(row.price) : "Sin precio"}
          {row.currency && row.currency !== "MXN" ? (
            <span className="ml-1 text-xs font-medium text-muted-foreground">
              {row.currency}
            </span>
          ) : null}
        </p>
        <h3 className="line-clamp-2 font-medium">{row.title}</h3>
        {locationLabel && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{locationLabel}</span>
          </p>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {CATEGORY_LABEL[row.category]}
          </span>
          {row.is_property && row.bedrooms !== null && (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="size-4" aria-hidden />
              {formatNumber(row.bedrooms)}
            </span>
          )}
          {row.is_property && row.bathrooms !== null && (
            <span className="inline-flex items-center gap-1">
              <Bath className="size-4" aria-hidden />
              {formatNumber(row.bathrooms)}
            </span>
          )}
          {row.is_property && row.area_m2 !== null && (
            <span className="inline-flex items-center gap-1">
              <Ruler className="size-4" aria-hidden />
              {formatNumber(row.area_m2)} m²
            </span>
          )}
          {row.condition && <span>{row.condition}</span>}
        </div>

        {row.listing_created_at && (
          <p className="text-xs text-muted-foreground">
            Publicado el {dateFormatter.format(new Date(row.listing_created_at))}
          </p>
        )}

        {feedback && (
          <div
            role={feedback.kind === "error" ? "alert" : "status"}
            className={cn(
              "mt-1 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm",
              feedback.kind === "error"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
            )}
          >
            {feedback.kind === "error" ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <span>
              {feedback.message}{" "}
              {feedback.slug && (
                <Link
                  href={`/property/${feedback.slug}`}
                  className="font-medium underline"
                >
                  Ver propiedad
                </Link>
              )}
            </span>
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
          {photoCount > 1 && (
            <SavedPhotosOrderEditor
              savedId={row.id}
              initialPhotos={row.photo_urls ?? []}
              onSaved={onPhotosReordered}
            />
          )}
          {row.is_property && row.status === "active" && (
            <Button type="button" size="sm" onClick={onImport} disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Import className="size-4" aria-hidden />
              )}
              Publicar en el portal
            </Button>
          )}
          {imported && row.imported_property_id && (
            <Link
              href={`/listings/${row.imported_property_id}/editar`}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Editar propiedad
            </Link>
          )}
          {imported && !confirmingDelete && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingDelete(true)}
              disabled={pending}
              className="ml-auto text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
              Borrar del sitio
            </Button>
          )}
          <a
            href={marketplaceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-[0.8rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Marketplace
          </a>
          {row.status === "discarded" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRestore}
              disabled={pending}
              className="ml-auto"
            >
              <RotateCcw className="size-4" aria-hidden />
              Restaurar
            </Button>
          ) : (
            !imported && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onDiscard}
                disabled={pending}
                className="ml-auto text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden />
                Descartar
              </Button>
            )
          )}
        </div>

        {imported && confirmingDelete && (
          <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <p>
              Se borrará la propiedad del sitio, con sus fotos, y saldrá de
              esta lista. No se puede deshacer.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={onDeleteProperty}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="size-4" aria-hidden />
                )}
                Sí, borrar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirmingDelete(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
