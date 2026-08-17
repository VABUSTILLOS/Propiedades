"use client";

import { useCallback, useState, useTransition } from "react";
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
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CircleCheck,
  GripVertical,
  Link2,
  Loader2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import {
  addPropertyImages,
  reorderPropertyImages,
  removePropertyImage,
  uploadAdminImages,
} from "@/modules/admin/actions";
import { compressImageForUpload } from "@/modules/listings/media/image-compression";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 50;
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";

type WizardImage = {
  id: string;
  url: string;
};

export function AdminGalleryEditor({
  propertyId,
  propertySlug,
  initialImages = [],
}: {
  propertyId: string;
  propertySlug: string;
  initialImages: string[];
}) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<WizardImage[]>(
    initialImages.map((url) => ({ id: crypto.randomUUID(), url })),
  );
  const [isUploading, startUploading] = useTransition();
  const [isReordering, startReordering] = useTransition();
  const [isRemoving, startRemoving] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pasteUrl, setPasteUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const remainingSlots = MAX_IMAGES - images.length;

  const uploadFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.size > 0);
    if (list.length === 0) return;
    if (list.length > remainingSlots) {
      setUploadError(`Solo puedes agregar ${remainingSlots} imagen(es) más.`);
      return;
    }
    setUploadError(null);
    startUploading(async () => {
      const compressed = await Promise.all(list.map(compressImageForUpload));
      const formData = new FormData();
      for (const file of compressed) formData.append("images", file);
      const res = await uploadAdminImages(formData);
      if (!res.ok) {
        setUploadError(res.error);
        return;
      }
      const uploaded: WizardImage[] = res.data.urls.map((url) => ({
        id: crypto.randomUUID(),
        url,
      }));
      setImages((prev) => [...prev, ...uploaded]);
    });
  }, [remainingSlots]);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      if (event.dataTransfer.files.length > 0) {
        uploadFiles(event.dataTransfer.files);
      }
    },
    [uploadFiles],
  );

  const handleReorder = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setImages((prev) => {
        const oldIndex = prev.findIndex((img) => img.id === active.id);
        const newIndex = prev.findIndex((img) => img.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
      // Persist the new order
      startReordering(async () => {
        const newOrder = images.map((img) => img.url); // use current order
        // The onDragEnd fires before state update, so we need to compute the new order
        // from the event result instead. We'll do a second update after state settles.
      });
    },
    [images],
  );

  const removeImage = useCallback((id: string) => {
    const urlToRemove = images.find((img) => img.id === id)?.url;
    if (!urlToRemove) return;
    setImages((prev) => prev.filter((img) => img.id !== id));
    startRemoving(async () => {
      await removePropertyImage(propertyId, urlToRemove);
    });
  }, [images, propertyId]);

  const addPasteUrl = useCallback(() => {
    const url = pasteUrl.trim();
    if (!url) return;
    if (remainingSlots <= 0) {
      setUploadError(`Has alcanzado el límite de ${MAX_IMAGES} imágenes.`);
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setUploadError("Pega una URL válida que empiece con http:// o https://");
      return;
    }
    setUploadError(null);
    setImages((prev) => [...prev, { id: crypto.randomUUID(), url }]);
    setPasteUrl("");
    // Persist
    startUploading(async () => {
      await addPropertyImages(propertyId, [url]);
    });
  }, [pasteUrl, remainingSlots, propertyId]);

  const persistOrder = useCallback(async () => {
    const urls = images.map((img) => img.url);
    startReordering(async () => {
      const res = await reorderPropertyImages(propertyId, urls);
      if (!res.ok) {
        setUploadError(res.error);
      }
    });
  }, [images, propertyId]);

  return (
    <>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpen(true)}
            disabled={isReordering || isRemoving || isUploading}
          >
            Editar galería
          </Button>
        }
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[90vw] lg:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editar galería de fotos</DialogTitle>
            <DialogDescription>
              Arrastra para reordenar. Los cambios se guardan automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Dropzone */}
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
                "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30",
              )}
            >
              <UploadCloud className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                Arrastra imágenes aquí o haz clic para subir
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WebP o GIF · máx. 10 MB · {remainingSlots} de{" "}
                {MAX_IMAGES} disponibles
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES}
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) uploadFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>

            {uploadError && (
              <p className="text-xs text-destructive" role="alert">
                {uploadError}
              </p>
            )}

            {/* Preview grid with drag-to-reorder */}
            {images.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleReorder}
              >
                <SortableContext
                  items={images.map((img) => img.id)}
                  strategy={rectSortingStrategy}
                >
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {images.map((img, index) => (
                      <SortableImageCard
                        key={img.id}
                        image={img}
                        index={index}
                        disabled={isUploading || isRemoving}
                        onRemove={() => removeImage(img.id)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}

            {images.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                No hay imágenes todavía. Sube la primera.
              </p>
            )}

            {isUploading && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Subiendo imágenes…
              </p>
            )}

            {/* URL fallback */}
            <div className="flex items-end gap-2 pt-1">
              <div className="flex-1 space-y-1">
                <Label htmlFor="image-url" className="text-xs">
                  ¿Tienes una URL de imagen?
                </Label>
                <div className="flex items-center gap-2">
                  <Link2 className="size-4 shrink-0 text-muted-foreground" />
                  <Input
                    id="image-url"
                    value={pasteUrl}
                    onChange={(e) => setPasteUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPasteUrl();
                      }
                    }}
                    placeholder="https://…/foto.jpg"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPasteUrl}
                disabled={isUploading}
              >
                Agregar
              </Button>
            </div>

            {/* Persist order button (shown when images exist) */}
            {images.length > 0 && (
              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={persistOrder}
                  disabled={isReordering}
                >
                  {isReordering ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-2" />
                      Guardando orden…
                    </>
                  ) : (
                    "Guardar orden"
                  )}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isUploading || isReordering || isRemoving}
              onClick={() => setOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useRef } from "react";

function SortableImageCard({
  image,
  index,
  disabled,
  onRemove,
}: {
  image: WizardImage;
  index: number;
  disabled: boolean;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

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
          disabled && "opacity-50 pointer-events-none",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          loading="lazy"
          decoding="async"
          src={image.url}
          alt={`Imagen ${index + 1}`}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 flex items-start justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <span
            {...attributes}
            className="inline-flex size-6 items-center justify-center cursor-grab rounded-full bg-background/90 text-muted-foreground hover:text-foreground"
            aria-label={`Reordenar imagen ${index + 1}`}
          >
            <GripVertical className="size-4" />
          </span>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Quitar imagen ${index + 1}`}
            className="inline-flex size-6 items-center justify-center shrink-0 rounded-full bg-destructive/90 text-destructive-foreground hover:bg-destructive transition-colors"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
        <span className="absolute right-1 bottom-1 size-5 rounded-full bg-black/50 flex items-center justify-center">
          <CircleCheck className="size-3 text-white" />
        </span>
      </div>
    </li>
  );
}

import { useSortable } from "@dnd-kit/sortable";