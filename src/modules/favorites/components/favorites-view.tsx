"use client";

import { useState } from "react";

import { FavoritesList } from "@/modules/favorites/components/favorites-list";
import { FavoritesKanban } from "@/modules/favorites/components/favorites-kanban";
import { cn } from "@/lib/utils";
import type { FavoriteWithProperty } from "@/modules/favorites/queries";

type Props = {
  favorites: FavoriteWithProperty[];
};

type ViewMode = "list" | "kanban";

/**
 * Toggle between the ranked list view and the CRM tier Kanban board.
 */
export function FavoritesView({ favorites }: Props) {
  const [mode, setMode] = useState<ViewMode>("list");

  return (
    <div>
      <div className="mb-6 inline-flex rounded-lg border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setMode("list")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "list"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Lista
        </button>
        <button
          type="button"
          onClick={() => setMode("kanban")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "kanban"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Kanban
        </button>
      </div>

      {mode === "list" ? (
        <FavoritesList initialFavorites={favorites} />
      ) : (
        <FavoritesKanban initialFavorites={favorites} />
      )}
    </div>
  );
}
