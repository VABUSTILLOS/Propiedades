"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useState, useTransition } from "react";
import { GripVertical, ListPlus, Trash2 } from "lucide-react";

import {
  removeFavorite,
  reorderFavoritesInColumn,
  setTierColumn,
} from "@/modules/favorites/actions";
import { AddToListDialog } from "@/modules/favorites/components/add-to-list-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TierColumn } from "@/modules/lib/schemas";
import type { FavoriteWithProperty } from "@/modules/favorites/queries";
import type { FavoriteListWithMeta } from "@/modules/favorites/lists-queries";

type Props = {
  initialFavorites: FavoriteWithProperty[];
  lists: FavoriteListWithMeta[];
  containingByProperty: Record<string, string[]>;
};

const COLUMNS: { id: TierColumn; label: string; dot: string }[] = [
  { id: "top_choice", label: "#1 Top Choice", dot: "bg-emerald-500" },
  { id: "plan_b", label: "Plan B", dot: "bg-amber-500" },
  { id: "discarded", label: "Descartadas", dot: "bg-rose-500" },
];

function tierOf(favorite: FavoriteWithProperty): TierColumn {
  const value = (favorite.tier_column ?? "top_choice") as TierColumn;
  return value === "plan_b" || value === "discarded" ? value : "top_choice";
}

function partition(
  favorites: FavoriteWithProperty[],
): Record<TierColumn, FavoriteWithProperty[]> {
  const result: Record<TierColumn, FavoriteWithProperty[]> = {
    top_choice: [],
    plan_b: [],
    discarded: [],
  };
  for (const favorite of favorites) {
    result[tierOf(favorite)].push(favorite);
  }
  for (const col of COLUMNS) {
    result[col.id].sort((a, b) => a.tier_rank - b.tier_rank);
  }
  return result;
}

/**
 * 3-column CRM Kanban board for favorites: #1 Top Choice / Plan B / Descartadas.
 * Cards can be dragged within a column (reorder) or across columns (re-tier).
 */
export function FavoritesKanban({
  initialFavorites,
  lists,
  containingByProperty,
}: Props): React.JSX.Element {
  const [columns, setColumns] = useState<Record<TierColumn, FavoriteWithProperty[]>>(
    () => partition(initialFavorites),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const findColumnOf = (id: string): TierColumn | null => {
    for (const col of COLUMNS) {
      if (columns[col.id].some((f) => f.id === id)) return col.id;
    }
    return null;
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const sourceCol = findColumnOf(activeIdStr);
    if (!sourceCol) return;

    const isColumnTarget = COLUMNS.some((c) => c.id === overIdStr);
    const targetCol: TierColumn | null = isColumnTarget
      ? (overIdStr as TierColumn)
      : ((over.data.current?.column as TierColumn | undefined) ??
        findColumnOf(overIdStr));
    if (!targetCol) return;

    const sameColumn = sourceCol === targetCol;

    if (sameColumn) {
      const items = columns[sourceCol];
      const oldIndex = items.findIndex((f) => f.id === activeIdStr);
      const newIndex = isColumnTarget
        ? items.length - 1
        : items.findIndex((f) => f.id === overIdStr);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(items, oldIndex, newIndex);
      setColumns((prev) => ({ ...prev, [sourceCol]: reordered }));

      startTransition(async () => {
        setError(null);
        const res = await reorderFavoritesInColumn({
          column: sourceCol,
          orderedIds: reordered.map((f) => f.id),
        });
        if (!res.ok) setError(res.error);
      });
      return;
    }

    const sourceItems = [...columns[sourceCol]];
    const moving = sourceItems.find((f) => f.id === activeIdStr);
    if (!moving) return;
    const newSourceItems = sourceItems.filter((f) => f.id !== activeIdStr);

    const targetItems = [...columns[targetCol]];
    const insertIndex = isColumnTarget
      ? targetItems.length
      : targetItems.findIndex((f) => f.id === overIdStr);
    const movedFavorite = { ...moving, tier_column: targetCol };
    const newTargetItems = [...targetItems];
    newTargetItems.splice(
      insertIndex === -1 ? targetItems.length : insertIndex,
      0,
      movedFavorite,
    );

    setColumns((prev) => ({
      ...prev,
      [sourceCol]: newSourceItems,
      [targetCol]: newTargetItems,
    }));

    startTransition(async () => {
      setError(null);
      const r1 = await setTierColumn({
        favoriteId: activeIdStr,
        tierColumn: targetCol,
      });
      if (!r1.ok) {
        setError(r1.error);
        return;
      }
      const r2 = await reorderFavoritesInColumn({
        column: targetCol,
        orderedIds: newTargetItems.map((f) => f.id),
      });
      if (!r2.ok) setError(r2.error);
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
      setColumns((prev) => {
        const next: Record<TierColumn, FavoriteWithProperty[]> = {
          top_choice: prev.top_choice.filter((f) => f.id !== favoriteId),
          plan_b: prev.plan_b.filter((f) => f.id !== favoriteId),
          discarded: prev.discarded.filter((f) => f.id !== favoriteId),
        };
        return next;
      });
    });

  const activeFavorite = activeId
    ? COLUMNS.flatMap((c) => columns[c.id]).find((f) => f.id === activeId)
    : null;

  return (
    <div>
      {error && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              dot={col.dot}
              favorites={columns[col.id]}
              disabled={isPending}
              onRemove={remove}
              lists={lists}
              containingByProperty={containingByProperty}
            />
          ))}
        </div>

        <DragOverlay>
          {activeFavorite ? (
            <FavoriteCardBody favorite={activeFavorite} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function KanbanColumn({
  id,
  label,
  dot,
  favorites,
  disabled,
  onRemove,
  lists,
  containingByProperty,
}: {
  id: TierColumn;
  label: string;
  dot: string;
  favorites: FavoriteWithProperty[];
  disabled: boolean;
  onRemove: (id: string) => void;
  lists: FavoriteListWithMeta[];
  containingByProperty: Record<string, string[]>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { column: id } });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[200px] flex-col gap-2 rounded-lg border bg-muted/30 p-3",
        isOver && "ring-2 ring-primary",
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className={cn("size-2 rounded-full", dot)} />
        <h2 className="text-sm font-semibold">{label}</h2>
        <Badge variant="secondary" className="ml-auto">
          {favorites.length}
        </Badge>
      </div>

      <SortableContext
        items={favorites.map((f) => f.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {favorites.map((favorite) => (
            <SortableCard
              key={favorite.id}
              favorite={favorite}
              column={id}
              disabled={disabled}
              onRemove={onRemove}
              lists={lists}
              containingListIds={
                favorite.property
                  ? (containingByProperty[favorite.property.id] ?? [])
                  : []
              }
            />
          ))}
        </div>
      </SortableContext>

      {favorites.length === 0 && (
        <div className="rounded-md border border-dashed px-3 py-8 text-center">
          <p className="text-xs text-muted-foreground">
            Sin propiedades — arrastra una aquí
          </p>
        </div>
      )}
    </div>
  );
}

function SortableCard({
  favorite,
  column,
  disabled,
  onRemove,
  lists,
  containingListIds,
}: {
  favorite: FavoriteWithProperty;
  column: TierColumn;
  disabled: boolean;
  onRemove: (id: string) => void;
  lists: FavoriteListWithMeta[];
  containingListIds: string[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: favorite.id, data: { column, id: favorite.id } });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "z-10 opacity-90")}
    >
      <FavoriteCardBody
        favorite={favorite}
        dragHandleProps={{ ...attributes, ...listeners }}
        disabled={disabled}
        onRemove={onRemove}
        lists={lists}
        containingListIds={containingListIds}
      />
    </div>
  );
}

function FavoriteCardBody({
  favorite,
  dragHandleProps,
  disabled,
  onRemove,
  lists,
  containingListIds,
  isOverlay,
}: {
  favorite: FavoriteWithProperty;
  dragHandleProps?: Record<string, unknown>;
  disabled?: boolean;
  onRemove?: (id: string) => void;
  lists?: FavoriteListWithMeta[];
  containingListIds?: string[];
  isOverlay?: boolean;
}) {
  const property = favorite.property;
  const image = property?.images?.[0];

  return (
    <Card
      className={cn(
        "flex items-center gap-2 p-2",
        isOverlay && "shadow-lg ring-2 ring-primary",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Reorder ${property?.title ?? "favorite"}`}
        {...dragHandleProps}
      >
        <GripVertical className="size-4" />
      </button>

      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={property?.title ?? ""}
          className="size-10 shrink-0 rounded object-cover"
        />
      )}

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
              {property.city} · ${property.price.toLocaleString()}
            </p>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">
            Property no longer available
          </span>
        )}
      </div>

      {lists && onRemove && (
        <AddToListDialog
          propertyId={property?.id ?? ""}
          lists={lists}
          initiallyContaining={containingListIds ?? []}
          trigger={
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={disabled || !property}
              aria-label={`Add ${property?.title ?? "property"} to a list`}
            >
              <ListPlus className="size-4" />
            </Button>
          }
        />
      )}

      {onRemove && (
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => onRemove(favorite.id)}
          aria-label="Remove favorite"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </Card>
  );
}
