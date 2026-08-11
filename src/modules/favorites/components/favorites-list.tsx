"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useState, useTransition } from "react";
import { GripVertical, Trash2 } from "lucide-react";

import { reorderFavorites, removeFavorite } from "@/modules/favorites/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FavoriteWithProperty } from "@/modules/favorites/queries";

type Props = {
  initialFavorites: FavoriteWithProperty[];
};

/**
 * Drag-to-rank tier list backed by React Query-style optimistic reorder.
 * Persists the full ordering via reorderFavorites on drag end.
 */
export function FavoritesList({ initialFavorites }: Props) {
  const [favorites, setFavorites] = useState(initialFavorites);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const oldIndex = favorites.findIndex((f) => f.id === active.id);
    const newIndex = favorites.findIndex((f) => f.id === over.id);
    const reordered = arrayMove(favorites, oldIndex, newIndex);
    setFavorites(reordered);

    startTransition(async () => {
      setError(null);
      const res = await reorderFavorites({
        orderedIds: reordered.map((f) => f.id),
      });
      if (!res.ok) setError(res.error);
    });
  };

  const remove = (favoriteId: string) =>
    startTransition(async () => {
      setError(null);
      const res = await removeFavorite(favoriteId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
    });

  return (
    <div>
      {error && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={favorites.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2">
            {favorites.map((favorite, index) => (
              <SortableRow
                key={favorite.id}
                favorite={favorite}
                rank={index + 1}
                disabled={isPending}
                onRemove={remove}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {favorites.length === 0 && (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No favorites yet. Browse the search page and rank what you like.
          </p>
          <Link href="/search" className={buttonVariants({ className: "mt-4" })}>
            Find properties
          </Link>
        </div>
      )}
    </div>
  );
}

function SortableRow({
  favorite,
  rank,
  disabled,
  onRemove,
}: {
  favorite: FavoriteWithProperty;
  rank: number;
  disabled: boolean;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: favorite.id });

  const property = favorite.property;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5",
        isDragging && "z-10 opacity-90 shadow-lg ring-2 ring-primary",
      )}
    >
      <Badge variant="secondary" className="w-6 shrink-0 justify-center">
        {rank}
      </Badge>

      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Reorder ${property?.title ?? "favorite"}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <div className="min-w-0 flex-1">
        {property ? (
          <>
            <Link
              href={`/property/${property.slug}`}
              className="block truncate text-sm font-medium hover:underline"
            >
              {property.title}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {property.city} · ${property.price.toLocaleString()} {property.currency}
            </p>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">
            Property no longer available
          </span>
        )}
        {favorite.private_notes && (
          <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">
            {favorite.private_notes}
          </p>
        )}
      </div>

      <Button
        size="icon-sm"
        variant="ghost"
        disabled={disabled}
        onClick={() => onRemove(favorite.id)}
        aria-label="Remove favorite"
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}
