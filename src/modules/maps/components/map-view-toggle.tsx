"use client";

import { List, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MapView = "list" | "map";

/**
 * Controlled List ⇄ Mapa pill. The parent owns the state so switching views
 * can update the URL (`mapSearch=true/false`) instead of only local state.
 */
export function MapViewToggle({
  view,
  onChange,
  count,
  label = "Lista",
}: {
  view: MapView;
  onChange: (view: MapView) => void;
  /** Number of current results — shown beside the map label when provided. */
  count?: number;
  label?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Cambiar vista"
      className="inline-flex items-center rounded-full border bg-muted/40 p-1"
    >
      <button
        role="tab"
        aria-selected={view === "list"}
        onClick={() => onChange("list")}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
          view === "list"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <List className="size-4" aria-hidden="true" />
        {label}
      </button>
      <button
        role="tab"
        aria-selected={view === "map"}
        onClick={() => onChange("map")}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
          view === "map"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <MapIcon className="size-4" aria-hidden="true" />
        Mapa{typeof count === "number" ? ` (${count})` : ""}
      </button>
    </div>
  );
}
