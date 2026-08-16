"use client";

import Link from "next/link";
import { Bath, BedDouble, MapPin, Ruler } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/ui/score-badge";
import { ShareWhatsAppButton } from "@/modules/chat/components/share-whatsapp-button";
import type { ChatResult } from "@/modules/chat/types";
import { isLandListing, propertyTypeLabel } from "@/modules/lib/real-estate";

/** Compact property card rendered inside the chat conversation. */
export function ChatResultCard({ result }: { result: ChatResult }) {
  // Land (terreno) is inferred: no constructed area, but plot area present.
  const isLand = isLandListing(result);
  const typeLabel = propertyTypeLabel(result.type, isLand);
  const price =
    result.price > 0
      ? `$${result.price.toLocaleString()} ${result.currency ?? "MXN"}`
      : "Precio por cotizar";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <div className="flex gap-3 p-3">
        <div className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-xl bg-muted sm:w-36">
          {result.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              loading="lazy"
              decoding="async"
              src={result.image}
              alt={result.title}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
              Sin foto
            </div>
          )}
          <Badge className="absolute left-1.5 top-1.5 rounded-full text-[0.65rem] shadow-sm">
            {typeLabel}
          </Badge>
          {result.relaxed && (
            <Badge className="absolute right-1.5 top-1.5 rounded-full bg-amber-500 text-[0.65rem] text-white shadow-sm hover:bg-amber-500">
              Alternativa
            </Badge>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <h4 className="line-clamp-2 text-sm font-semibold leading-snug">
              {result.title}
            </h4>
            <ScoreBadge score={result.score} className="shrink-0" />
          </div>

          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="line-clamp-1">
              {result.colonia ? `${result.colonia}, ` : ""}
              {result.city}
            </span>
          </p>

          {(result.recamaras != null ||
            result.banos != null ||
            result.construccion_m2 > 0 ||
            isLand) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {result.recamaras != null && (
                <span className="inline-flex items-center gap-1">
                  <BedDouble className="size-3" />
                  {result.recamaras}
                </span>
              )}
              {result.banos != null && (
                <span className="inline-flex items-center gap-1">
                  <Bath className="size-3" />
                  {result.banos}
                </span>
              )}
              {isLand ? (
                <span className="inline-flex items-center gap-1">
                  <Ruler className="size-3" />
                  {result.terreno_m2.toLocaleString()} m² terreno
                </span>
              ) : (
                result.construccion_m2 > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Ruler className="size-3" />
                    {result.construccion_m2.toLocaleString()} m²
                  </span>
                )
              )}
            </div>
          )}

          <p className="mt-auto pt-1 text-base font-bold">{price}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
        <ShareWhatsAppButton property={result} compact />
        <Link
          href={`/property/${result.slug}`}
          className="inline-flex h-7 items-center rounded-full bg-gradient-to-br from-primary to-copper-deep px-3 text-xs font-medium text-white shadow-sm transition-all hover:from-copper-deep hover:to-copper-ink"
        >
          Ver detalles
        </Link>
      </div>
    </div>
  );
}
