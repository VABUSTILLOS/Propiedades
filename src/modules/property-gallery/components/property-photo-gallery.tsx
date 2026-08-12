"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  images: string[];
  title: string;
};

/**
 * Airbnb-style photo gallery for a property listing.
 *
 * - Bento grid preview (first photo large, up to 5 tiles).
 * - Clicking a tile opens a fullscreen lightbox to browse photos one by one
 *   (arrows, thumbnails, keyboard ←/→/Esc, counter).
 * - "Ver todas las fotos" opens a panel with every photo in a grid.
 */
export function PropertyPhotoGallery({ images, title }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const count = images.length;

  const openLightbox = useCallback((index: number) => {
    setShowAll(false);
    setActiveIndex(index);
  }, []);

  const closeLightbox = useCallback(() => setActiveIndex(null), []);

  const goPrev = useCallback(() => {
    setActiveIndex((i) => (i === null ? i : (i + count - 1) % count));
  }, [count]);

  const goNext = useCallback(() => {
    setActiveIndex((i) => (i === null ? i : (i + 1) % count));
  }, [count]);

  // Lock body scroll while an overlay is open.
  useEffect(() => {
    const isOpen = activeIndex !== null || showAll;
    if (!isOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [activeIndex, showAll]);

  // Keyboard navigation: Escape closes any open overlay, arrows navigate the lightbox.
  useEffect(() => {
    const isOpen = activeIndex !== null || showAll;
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAll(false);
        closeLightbox();
      } else if (event.key === "ArrowLeft") {
        goPrev();
      } else if (event.key === "ArrowRight") {
        goNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, showAll, closeLightbox, goPrev, goNext]);

  if (count === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No photos yet
      </div>
    );
  }

  const preview = images.slice(0, 5);

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:grid-rows-2">
        {preview.map((src, i) => {
          const opensAll = i === 4 && count > 5;

          return (
            <button
              key={`${i}-${src}`}
              type="button"
              onClick={() => (opensAll ? setShowAll(true) : openLightbox(i))}
              aria-label={
                opensAll
                  ? `Ver todas las fotos (${count})`
                  : `Ver foto ${i + 1} de ${count} de ${title}`
              }
              className={cn(
                "group relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-lg bg-muted",
                i === 0 && "col-span-2 row-span-2 aspect-auto sm:h-full",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${title} — foto ${i + 1}`}
                className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {opensAll && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 transition-colors group-hover:bg-black/50">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black shadow-sm">
                    <Images className="size-3.5" />
                    Ver +{count - 5}
                    <span className="sr-only"> fotos</span>
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {showAll && (
          <PhotoGridPanel
            images={images}
            title={title}
            onClose={() => setShowAll(false)}
            onSelect={openLightbox}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeIndex !== null && (
          <Lightbox
            images={images}
            title={title}
            index={activeIndex}
            onSelect={setActiveIndex}
            onClose={closeLightbox}
            onPrev={goPrev}
            onNext={goNext}
            onShowAll={() => {
              closeLightbox();
              setShowAll(true);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Lightbox({
  images,
  title,
  index,
  onSelect,
  onClose,
  onPrev,
  onNext,
  onShowAll,
}: {
  images: string[];
  title: string;
  index: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onShowAll: () => void;
}) {
  const count = images.length;
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${title}`}
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm font-medium tabular-nums">
          {index + 1} / {count}
        </p>
        <div className="flex items-center gap-2">
          {count > 1 && (
            <button
              type="button"
              onClick={onShowAll}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/15"
            >
              <Images className="size-4" />
              Ver todas
            </button>
          )}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar galería"
            className="inline-flex size-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={index}
            src={images[index]}
            alt={`${title} — foto ${index + 1}`}
            className="max-h-full max-w-full object-contain"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        </AnimatePresence>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={onPrev}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label="Foto siguiente"
              className="absolute right-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex items-center justify-center gap-2 overflow-x-auto px-4 pb-5">
          {images.map((src, i) => (
            <button
              key={`${i}-${src}`}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`Foto ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "relative shrink-0 overflow-hidden rounded-md",
                i === index
                  ? "ring-2 ring-white ring-offset-2 ring-offset-black"
                  : "opacity-60 transition-opacity hover:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="size-14 object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function PhotoGridPanel({
  images,
  title,
  onClose,
  onSelect,
}: {
  images: string[];
  title: string;
  onClose: () => void;
  onSelect: (index: number) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Todas las fotos de ${title}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <h2 className="text-base font-semibold">
          Todas las fotos ({images.length})
        </h2>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Cerrar panel de fotos"
          className="inline-flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <X className="size-5" />
        </button>
      </div>

      <div
        className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {images.map((src, i) => (
          <button
            key={`${i}-${src}`}
            type="button"
            onClick={() => onSelect(i)}
            aria-label={`Ver foto ${i + 1} de ${images.length} de ${title}`}
            className="group aspect-[4/3] overflow-hidden rounded-lg bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`${title} — foto ${i + 1}`}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
