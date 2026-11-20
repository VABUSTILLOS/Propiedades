"use client";

import { Columns2, List, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MapView = "list" | "map" | "split";

/**
 * Controlled Lista ⇄ Mapa ⇄ Dividido pill. The parent owns the state so
 * switching views can update the URL (`view=list|map|split`) instead of only
 * local state.
 */
export function MapViewToggle({
  view,
  onChange,
  count,
  label = "Lista",
  compact = false,
}: {
  view: MapView;
  onChange: (view: MapView) => void;
  /** Number of current results — shown beside the map label when provided. */
  count?: number;
  label?: string;
  /** Icon-only variant for tight spaces (mobile split sheet header). */
  compact?: boolean;
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
        aria-label={label}
        onClick={() => onChange("list")}
        className={cn(
          "inline-flex items-center gap-2 rounded-full py-2 text-sm font-medium transition-colors",
          compact ? "px-3" : "px-4",
          view === "list"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <List className="size-4" aria-hidden="true" />
        {compact ? <span className="sr-only">{label}</span> : label}
      </button>
      <button
        role="tab"
        aria-selected={view === "map"}
        aria-label="Mapa"
        onClick={() => onChange("map")}
        className={cn(
          "inline-flex items-center gap-2 rounded-full py-2 text-sm font-medium transition-colors",
          compact ? "px-3" : "px-4",
          view === "map"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <MapIcon className="size-4" aria-hidden="true" />
        {compact ? (
          <span className="sr-only">Mapa</span>
        ) : (
          <>Mapa{typeof count === "number" ? ` (${count})` : ""}</>
        )}
      </button>
      <button
        role="tab"
        aria-selected={view === "split"}
        aria-label="Dividido"
        onClick={() => onChange("split")}
        className={cn(
          "inline-flex items-center gap-2 rounded-full py-2 text-sm font-medium transition-colors",
          compact ? "px-3" : "px-4",
          view === "split"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Columns2 className="size-4" aria-hidden="true" />
        {compact ? <span className="sr-only">Dividido</span> : "Dividido"}
      </button>
    </div>
  );
}
