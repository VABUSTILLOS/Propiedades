"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, Trash2 } from "lucide-react";

import { bulkUpdateMyListings } from "@/modules/listings/actions";
import { ListingCard } from "@/modules/listings/components/listing-card";
import { Button } from "@/components/ui/button";
import type { PropertiesRow } from "@/modules/lib/database.types";

/**
 * Grid de "Mis listados" con selección múltiple: checkboxes por tarjeta,
 * "seleccionar todos" y una barra sticky con acciones masivas
 * (archivar / eliminar).
 */
export function MyListingsGrid({ listings }: { listings: PropertiesRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const allSelected =
    listings.length > 0 && selected.size === listings.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(listings.map((l) => l.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const run = (action: "archive" | "delete") => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (
      action === "delete" &&
      !window.confirm(
        `¿Eliminar ${ids.length} ${ids.length === 1 ? "listado" : "listados"}? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      setActionError(null);
      const res = await bulkUpdateMyListings(ids, action);
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  };

  return (
    <div>
      <label className="mt-6 flex w-fit items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          aria-label="Seleccionar todos"
          className="size-4 accent-primary"
        />
        Seleccionar todos
      </label>

      {selected.size > 0 && (
        <div className="sticky top-4 z-10 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border bg-background px-4 py-3 shadow-lg">
          <span className="text-sm font-medium">
            {selected.size}{" "}
            {selected.size === 1 ? "seleccionado" : "seleccionados"}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run("archive")}
            >
              <Archive className="size-4" />
              Archivar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={() => run("delete")}
            >
              <Trash2 className="size-4" />
              Eliminar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => setSelected(new Set())}
            >
              Cancelar
            </Button>
          </div>
          {isPending && <Loader2 className="size-4 animate-spin" />}
        </div>
      )}

      {actionError && (
        <p
          className="mt-4 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {actionError}
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <div
            key={listing.id}
            className={
              selected.has(listing.id)
                ? "relative rounded-xl ring-2 ring-primary"
                : "relative"
            }
          >
            <input
              type="checkbox"
              checked={selected.has(listing.id)}
              onChange={() => toggleOne(listing.id)}
              aria-label={`Seleccionar ${listing.title}`}
              className="absolute left-3 top-3 z-10 size-4 accent-primary"
            />
            <ListingCard listing={listing} />
          </div>
        ))}
      </div>
    </div>
  );
}
