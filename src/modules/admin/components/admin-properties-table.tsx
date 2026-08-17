"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminGalleryEditor } from "@/modules/admin/components/admin-gallery-editor";
import {
  bulkModerateProperties,
  permanentDeleteProperties,
} from "@/modules/admin/actions";
import type {
  AdminPropertyFilter,
  AdminPropertyRow,
} from "@/modules/admin/queries";

const STATUS_LABELS: Record<AdminPropertyRow["status"], string> = {
  draft: "Borrador",
  pending_approval: "Pendiente",
  active: "Activo",
  reserved: "Reservado",
  sold: "Vendido",
  archived: "Archivado",
  deleted: "Borrado",
};

const STATUS_VARIANTS: Record<
  AdminPropertyRow["status"],
  "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"
> = {
  draft: "secondary",
  pending_approval: "outline",
  active: "default",
  reserved: "ghost",
  sold: "ghost",
  archived: "ghost",
  deleted: "destructive",
};

function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `$${price.toLocaleString("es-MX")}`;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Moderation table for the master user: checkbox selection plus bulk
 * archive / soft-delete / restore / permanent-delete actions.
 */
export function AdminPropertiesTable({
  properties,
  filter,
}: {
  properties: AdminPropertyRow[];
  filter: AdminPropertyFilter;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const allSelected =
    properties.length > 0 && selected.size === properties.length;

  const toggleAll = () => {
    setSelected(
      allSelected ? new Set() : new Set(properties.map((p) => p.id)),
    );
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const run = (
    action: "archive" | "delete" | "restore" | "permanent",
  ) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (
      action === "permanent" &&
      !window.confirm(
        `¿Eliminar definitivamente ${ids.length} ${ids.length === 1 ? "propiedad" : "propiedades"}? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      setActionError(null);
      const res =
        action === "permanent"
          ? await permanentDeleteProperties(ids)
          : await bulkModerateProperties(ids, action);
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
      {selected.size > 0 && (
        <div className="sticky top-4 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-2xl border bg-background px-4 py-3 shadow-lg">
          <span className="text-sm font-medium">
            {selected.size}{" "}
            {selected.size === 1 ? "seleccionada" : "seleccionadas"}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {filter !== "deleted" && (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => run("archive")}
              >
                <Archive className="size-4" />
                Archivar
              </Button>
            )}
            {filter !== "all" && (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => run("restore")}
              >
                <ArchiveRestore className="size-4" />
                Restaurar
              </Button>
            )}
            {filter !== "deleted" ? (
              <Button
                size="sm"
                variant="destructive"
                disabled={isPending}
                onClick={() => run("delete")}
              >
                <Trash2 className="size-4" />
                Borrar
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                disabled={isPending}
                onClick={() => run("permanent")}
              >
                <Trash2 className="size-4" />
                Eliminar definitivamente
              </Button>
            )}
          </div>
          {isPending && <Loader2 className="size-4 animate-spin" />}
        </div>
      )}

      {actionError && (
        <p className="mb-4 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Seleccionar todas"
                  className="size-4 accent-primary"
                />
              </th>
              <th className="px-4 py-3 font-medium">Propiedad</th>
              <th className="px-4 py-3 font-medium">Precio</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Ubicación
              </th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">
                Dueño
              </th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Actualizada
              </th>
              <th className="px-4 py-3 font-medium">Galería</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => (
              <tr
                key={p.id}
                className={
                  selected.has(p.id)
                    ? "border-b bg-primary/5 last:border-0"
                    : "border-b last:border-0"
                }
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleOne(p.id)}
                    aria-label={`Seleccionar ${p.title}`}
                    className="size-4 accent-primary"
                  />
                </td>
                <td className="max-w-64 px-4 py-3">
                  <Link
                    href={`/property/${p.slug}`}
                    className="line-clamp-2 font-medium hover:underline"
                  >
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono tabular-nums">
                  {formatPrice(p.price, p.currency)}
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                  {[p.colonia, p.city].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                  {p.owner_name || p.owner_email || "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANTS[p.status]}>
                    {STATUS_LABELS[p.status]}
                  </Badge>
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                  {formatDate(p.updated_at)}
                </td>
                <td className="px-4 py-3">
                  <AdminGalleryEditor
                    propertyId={p.id}
                    propertySlug={p.slug}
                    initialImages={p.images ?? []}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
