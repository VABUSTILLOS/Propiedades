"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { bulkModerateProperties } from "@/modules/admin/actions";
import type { PropertyStatus } from "@/modules/lib/database.types";

/**
 * Single-property moderation for the master user (admin): archive, soft-delete
 * or restore from the property detail view. Mirrors the bulk actions available
 * in the admin table.
 */
export function PropertyModerationActions({
  propertyId,
  status,
}: {
  propertyId: string;
  status: PropertyStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const run = (action: "archive" | "delete" | "restore") => {
    if (
      action === "delete" &&
      !window.confirm(
        "¿Borrar esta propiedad? Quedará oculta de los listados públicos y podrás recuperarla desde el panel de administración.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      setActionError(null);
      const res = await bulkModerateProperties([propertyId], action);
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const isInactive = status === "archived" || status === "deleted";

  if (isInactive) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => run("restore")}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArchiveRestore className="size-4" />
          )}
          Restaurar
        </Button>
        <span className="text-xs font-medium text-muted-foreground">
          {status === "archived" ? "Propiedad archivada" : "Propiedad borrada"}
        </span>
        {actionError && <span className="text-xs text-destructive">{actionError}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => run("archive")}
      >
        <Archive className="size-4" />
        Archivar
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={() => run("delete")}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
        Borrar
      </Button>
      {actionError && <span className="text-xs text-destructive">{actionError}</span>}
    </div>
  );
}
