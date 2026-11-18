"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Swipeable photo strip for the property card image area. Native
 * scroll-snap provides touch swipe (and trackpad scrolling) with no drag
 * logic; on desktop, hover arrows page through the photos. Dots at the
 * bottom track the visible photo. Clicks on the photos themselves fall
 * through to the card link — only the arrow buttons intercept them, the
 * same pattern as CardFavoriteButton.
 */
export function CardPhotoCarousel({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    setIndex(Math.max(0, Math.min(images.length - 1, next)));
  };

  const onPrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = trackRef.current;
    if (el) el.scrollBy({ left: -el.clientWidth, behavior: "smooth" });
  };

  const onNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = trackRef.current;
    if (el) el.scrollBy({ left: el.clientWidth, behavior: "smooth" });
  };

  const arrowClass =
    "absolute top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-700 opacity-0 shadow-sm backdrop-blur transition-opacity hover:bg-white focus-visible:opacity-100 group-hover/carousel:opacity-100 md:flex";

  return (
    <div className="group/carousel relative size-full">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          <div key={`${src}-${i}`} className="h-full w-full shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              loading="lazy"
              decoding="async"
              draggable={false}
              src={src}
              alt={i === 0 ? title : ""}
              className="size-full select-none object-cover"
            />
          </div>
        ))}
      </div>

      {index > 0 && (
        <button
          type="button"
          onClick={onPrev}
          aria-label="Foto anterior"
          className={cn(arrowClass, "left-2")}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
      )}
      {index < images.length - 1 && (
        <button
          type="button"
          onClick={onNext}
          aria-label="Foto siguiente"
          className={cn(arrowClass, "right-2")}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1">
        {images.map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-1.5 rounded-full shadow-sm transition-colors",
              i === index ? "bg-white" : "bg-white/50",
            )}
          />
        ))}
      </div>
    </div>
  );
}
