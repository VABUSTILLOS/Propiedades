"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { bulkModerateProperties } from "@/modules/admin/actions";
import { cn } from "@/lib/utils";

/**
 * Direct per-property delete for the master user (admin) on the public
 * listing grids (Comprar/Rentas, Destacadas) and the split detail panel.
 *
 * Rendered only when the server already determined the current user is
 * admin (`canModerate`); the server action re-checks the role anyway.
 * Deleting is the same soft-delete as the bulk moderation flow: the
 * property leaves the public listings at once and stays recoverable
 * from "Propiedades borradas" in the admin panel. An inline
 * confirmation step guards against accidental taps — there is no
 * need to enter the "Seleccionar" bulk mode to remove a single listing.
 */
export function DeletePropertyButton({
  propertyId,
  onDeleted,
  className,
}: {
  propertyId: string;
  /** Called after a successful delete (parents drop the card locally). */
  onDeleted?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const runDelete = () => {
    startTransition(async () => {
      setError(null);
      const res = await bulkModerateProperties([propertyId], "delete");
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (onDeleted) onDeleted();
      else router.refresh();
    });
  };

  if (!confirming) {
    return (
      <div className={className}>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => setConfirming(true)}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
          Eliminar
        </Button>
        {error && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive",
        className,
      )}
    >
      <p>
        Se quitará de los listados públicos. Podrás recuperarla desde
        Propiedades borradas en el panel.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={runDelete}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-4" aria-hidden />
          )}
          Sí, eliminar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
