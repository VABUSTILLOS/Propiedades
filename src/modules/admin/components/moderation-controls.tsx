"use client";

import { Archive, CheckSquare, Loader2, Square, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shared moderation UI for the master user (admin): the "Seleccionar" toggle,
 * the per-card selection shell (checkbox overlay + ring + click capture) and
 * the floating bulk-action bar. Used by the public listing grids
 * (InfiniteListings, FeaturedListings) so archive/delete works the same
 * everywhere.
 */
export function ModerationToggleButton({
  selecting,
  onToggle,
}: {
  selecting: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant={selecting ? "default" : "outline"}
      size="sm"
      onClick={onToggle}
    >
      {selecting ? "Cancelar selección" : "Seleccionar"}
    </Button>
  );
}

/**
 * Wraps a listing card while selection mode is active: shows the checkbox
 * overlay, highlights selected cards with a ring and turns clicks into
 * selection toggles instead of navigation.
 */
export function SelectableCardShell({
  selecting,
  selected,
  onToggle,
  onMouseEnter,
  onMouseLeave,
  onCardClickCapture,
  children,
}: {
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  /** Capture-phase click handler for when selection mode is OFF (split view). */
  onCardClickCapture?: (e: React.MouseEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        selecting
          ? selected
            ? "relative rounded-2xl ring-2 ring-primary"
            : "relative"
          : undefined
      }
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClickCapture={
        selecting
          ? (e) => {
              // Selection mode: clicking a card toggles its checkbox instead
              // of navigating. Interactive children (favorite bookmark, …)
              // keep their own behavior.
              const target = e.target as Element | null;
              if (target && typeof target.closest === "function") {
                if (
                  target.closest("button, [role='button'], input, select, textarea")
                ) {
                  return;
                }
              }
              e.preventDefault();
              e.stopPropagation();
              onToggle();
            }
          : onCardClickCapture
      }
    >
      {selecting && (
        <span
          className="absolute left-2 top-2 z-20 rounded-full bg-background/90 p-1 text-primary shadow"
          aria-hidden="true"
        >
          {selected ? (
            <CheckSquare className="size-5" />
          ) : (
            <Square className="size-5" />
          )}
        </span>
      )}
      {children}
    </div>
  );
}

/** Floating bulk-action bar shown at the bottom while cards are selected. */
export function ModerationActionBar({
  count,
  moderating,
  onAction,
}: {
  count: number;
  moderating: boolean;
  onAction: (action: "archive" | "delete") => void;
}) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-full border bg-background px-5 py-3 shadow-xl">
      <span className="text-sm font-medium">
        {count} {count === 1 ? "seleccionada" : "seleccionadas"}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={moderating}
        onClick={() => onAction("archive")}
      >
        <Archive className="size-4" />
        Archivar
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={moderating}
        onClick={() => onAction("delete")}
      >
        <Trash2 className="size-4" />
        Borrar
      </Button>
      {moderating && <Loader2 className="size-4 animate-spin" />}
    </div>
  );
}
