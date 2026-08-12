"use client";

import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pill that shows/hides the optional financial details on listing cards
 * (predial est., escrituración est., barra hot, $/m² constr., $/m² terreno,
 * % descuento vs colonia). Controlled by the parent so it can persist to
 * localStorage.
 */
export function CardDetailsToggle({
  show,
  onChange,
}: {
  show: boolean;
  onChange: (show: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!show)}
      aria-pressed={show}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        show
          ? "border-primary/30 bg-primary/10 text-primary"
          : "bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {show ? (
        <Eye className="size-4" aria-hidden="true" />
      ) : (
        <EyeOff className="size-4" aria-hidden="true" />
      )}
      {show ? "Ocultar detalles" : "Mostrar detalles"}
    </button>
  );
}
