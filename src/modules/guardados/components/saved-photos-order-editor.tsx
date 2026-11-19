"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Images,
  Loader2,
} from "lucide-react";

import { reorderSavedListingPhotos } from "@/modules/guardados/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type PhotoItem = {
  id: string;
  url: string;
};

/**
 * Photo-order editor for a Marketplace saved listing (master only, the
 * Guardados page is admin-only). Drag a photo — or use its arrow
 * buttons — to reorder; the first photo is the cover in Guardados and,
 * once imported, in the public listings too. Every change persists
 * immediately through `reorderSavedListingPhotos`, which also syncs
 * the imported property's gallery when there is one.
 */
export function SavedPhotosOrderEditor({
  savedId,
  initialPhotos = [],
  onSaved,
}: {
  savedId: string;
  initialPhotos: string[];
  /** Called with the persisted order so the card updates its cover. */
  onSaved?: (photoUrls: string[]) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>(
    initialPhotos.map((url) => ({ id: crypto.randomUUID(), url })),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const dirtyRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const persist = useCallback(
    (next: PhotoItem[], prev: PhotoItem[]) => {
      setPhotos(next);
      startSaving(async () => {
        const res = await reorderSavedListingPhotos(
          savedId,
          next.map((photo) => photo.url),
        );
        if (!res.ok) {
          setError(res.error);
          setPhotos(prev);
          return;
        }
        setError(null);
        dirtyRef.current = true;
        onSaved?.(res.data.photo_urls);
      });
    },
    [savedId, onSaved],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = photos.findIndex((photo) => photo.id === active.id);
    const newIndex = photos.findIndex((photo) => photo.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    persist(arrayMove(photos, oldIndex, newIndex), photos);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    persist(arrayMove(photos, index, target), photos);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && dirtyRef.current) {
      dirtyRef.current = false;
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" disabled={isSaving}>
            <Images className="size-4" aria-hidden />
            Ordenar fotos
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[90vw] lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Orden de fotos</DialogTitle>
          <DialogDescription>
            Arrastra las fotos o usa las flechas para cambiar el orden. La
            primera foto es la portada. Los cambios se guardan
            automáticamente.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        {photos.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={photos.map((photo) => photo.id)}
              strategy={rectSortingStrategy}
            >
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((photo, index) => (
                  <SortablePhotoCard
                    key={photo.id}
                    photo={photo}
                    index={index}
                    total={photos.length}
                    disabled={isSaving}
                    onMove={(direction) => move(index, direction)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Esta publicación no tiene fotos.
          </p>
        )}

        {isSaving && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Guardando orden…
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={isSaving}
            onClick={() => handleOpenChange(false)}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortablePhotoCard({
  photo,
  index,
  total,
  disabled,
  onMove,
}: {
  photo: PhotoItem;
  index: number;
  total: number;
  disabled: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} {...attributes}>
      <div
        {...listeners}
        className={cn(
          "group relative aspect-square overflow-hidden rounded-lg border bg-muted",
          isDragging && "z-10 opacity-90 shadow-lg ring-2 ring-primary",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          loading="lazy"
          decoding="async"
          src={photo.url}
          alt={`Foto ${index + 1}`}
          className="size-full object-cover"
        />
        <span className="absolute top-1 left-1 inline-flex size-6 cursor-grab items-center justify-center rounded-full bg-background/90 text-muted-foreground">
          <GripVertical className="size-4" aria-hidden />
        </span>
        <span className="absolute right-1 bottom-1 inline-flex size-5 items-center justify-center rounded-full bg-black/60 text-[10px] font-semibold text-white">
          {index + 1}
        </span>
        {index === 0 && (
          <span className="absolute bottom-1 left-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            Portada
          </span>
        )}
        <div className="absolute inset-x-0 top-1 flex justify-end gap-1 pr-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={disabled || index === 0}
            aria-label={`Mover foto ${index + 1} antes`}
            className="inline-flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground transition-colors hover:bg-background disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={disabled || index === total - 1}
            aria-label={`Mover foto ${index + 1} después`}
            className="inline-flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground transition-colors hover:bg-background disabled:opacity-40"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}
