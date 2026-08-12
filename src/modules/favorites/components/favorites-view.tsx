"use client";

import { useState } from "react";

import { FavoritesList } from "@/modules/favorites/components/favorites-list";
import { FavoritesKanban } from "@/modules/favorites/components/favorites-kanban";
import { ListsView } from "@/modules/favorites/components/lists-view";
import { cn } from "@/lib/utils";
import type { FavoriteWithProperty } from "@/modules/favorites/queries";
import type { FavoriteListWithMeta } from "@/modules/favorites/lists-queries";

type Props = {
  favorites: FavoriteWithProperty[];
  lists: FavoriteListWithMeta[];
  containingByProperty: Record<string, string[]>;
};

type ViewMode = "list" | "kanban" | "lists";

/**
 * Toggle between the ranked list view, the CRM tier Kanban board, and the
 * custom favorites lists.
 */
export function FavoritesView({ favorites, lists, containingByProperty }: Props) {
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
        <button
          type="button"
          onClick={() => setMode("lists")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "lists"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Listas
        </button>
      </div>

      {mode === "list" ? (
        <FavoritesList
          initialFavorites={favorites}
          lists={lists}
          containingByProperty={containingByProperty}
        />
      ) : mode === "kanban" ? (
        <FavoritesKanban
          initialFavorites={favorites}
          lists={lists}
          containingByProperty={containingByProperty}
        />
      ) : (
        <ListsView lists={lists} />
      )}
    </div>
  );
}
