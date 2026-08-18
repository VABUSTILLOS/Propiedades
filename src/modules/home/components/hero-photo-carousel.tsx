"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  images: string[];
  title: string;
};

/**
 * Photo carousel for the hero "deal of the week" card. Arrows, dots and a
 * horizontal swipe cycle through the property's photos without leaving the
 * card: interactive controls stop propagation so the surrounding link only
 * navigates when the photo itself is clicked.
 */
export function HeroPhotoCarousel({ images, title }: Props) {
  const [index, setIndex] = useState(0);
  const draggedRef = useRef(false);
  const count = images.length;

  const goPrev = useCallback(
    () => setIndex((i) => (i + count - 1) % count),
    [count],
  );

  const goNext = useCallback(
    () => setIndex((i) => (i + 1) % count),
    [count],
  );

  // After a swipe the browser fires a click that would navigate the card;
  // suppress it so the gesture only changes the photo.
  const onPhotoClick = (event: React.MouseEvent) => {
    if (!draggedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    draggedRef.current = false;
  };

  const stopAnd = (handler: () => void) => (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    handler();
  };

  return (
    <div
      className="group/carousel relative size-full overflow-hidden select-none"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") goPrev();
        else if (event.key === "ArrowRight") goNext();
      }}
    >
      <AnimatePresence initial={false}>
        <motion.img
          key={index}
          src={images[index]}
          alt={`${title} — foto ${index + 1} de ${count}`}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
          drag={count > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragStart={() => {
            draggedRef.current = false;
          }}
          onDragEnd={(_event, info: PanInfo) => {
            const { offset, velocity } = info;
            const swiped =
              Math.abs(offset.x) > 60 &&
              Math.abs(offset.x) > Math.abs(offset.y);
            if (!swiped) return;
            draggedRef.current = true;
            if (velocity.x < 0 || offset.x < 0) goNext();
            else goPrev();
          }}
          onClick={onPhotoClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        />
      </AnimatePresence>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={stopAnd(goPrev)}
            aria-label="Foto anterior"
            className="absolute left-3 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-200 hover:bg-black/65 focus-visible:opacity-100 group-hover/carousel:opacity-100"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={stopAnd(goNext)}
            aria-label="Foto siguiente"
            className="absolute right-3 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-200 hover:bg-black/65 focus-visible:opacity-100 group-hover/carousel:opacity-100"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}

      <div
        className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-0.5 font-mono text-xs font-medium tabular-nums text-white backdrop-blur-sm"
        aria-live="polite"
      >
        {index + 1} / {count}
      </div>

      {count > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={stopAnd(() => setIndex(i))}
              aria-label={`Ir a la foto ${i + 1} de ${count}`}
              aria-current={i === index}
              className={cn(
                "h-1.5 rounded-full bg-white/70 transition-all duration-200",
                i === index
                  ? "w-4 opacity-100"
                  : "w-1.5 opacity-60 hover:opacity-100",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
