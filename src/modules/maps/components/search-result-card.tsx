"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/ui/score-badge";
import { HotnessGauge } from "@/modules/market-data/components/hotness-gauge";
import {
  estimateEscrituracion,
  estimatePredial,
  formatMxn,
  isFinanciable,
} from "@/modules/lib/real-estate";
import type { PropertyDealType } from "@/modules/lib/database.types";

/**
 * Search result card used by the infinite list and the map-zone grid.
 * Pure presentational; the favorite bookmark is a separate client component.
 */
export function SearchResultCard({
  title,
  slug,
  city,
  price,
  currency,
  type,
  dealType,
  image,
  score,
  hotScore,
}: {
  title: string;
  slug: string;
  city: string;
  price: number;
  currency: string;
  type: "sale" | "rent";
  dealType: PropertyDealType;
  image: string | null;
  score: number | null;
  hotScore: number | null;
}) {
  const showCosts = type === "sale" && price > 0;
  const financiable = isFinanciable(dealType);

  return (
    <div className="group block motion-safe:transition-all motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md">
      <Link href={`/property/${slug}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={title}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted text-xs text-muted-foreground">
              Sin foto
            </div>
          )}
          <div className="absolute left-3 top-3 flex gap-2">
            <Badge className="rounded-full shadow-sm">
              {type === "rent" ? "Renta" : "Venta"}
            </Badge>
          </div>
          <ScoreBadge
            score={score}
            solid
            className="absolute right-3 top-3 rounded-full"
          />
        </div>

        <div className="space-y-1.5 pt-3">
          <h3 className="line-clamp-1 font-semibold leading-snug group-hover:underline">
            {title}
          </h3>
          <p className="line-clamp-1 text-sm text-muted-foreground">{city}</p>
          <p className="font-bold">
            ${price.toLocaleString()}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {currency} · {type === "rent" ? "renta" : "venta"}
            </span>
          </p>
          <HotnessGauge score={hotScore} />
        </div>
      </Link>

      {showCosts && (
        <div className="space-y-1 pt-3">
          <p className="text-xs text-muted-foreground">
            Predial est. {formatMxn(estimatePredial(price))}/año · Escrituración
            est. {formatMxn(estimateEscrituracion(price))}
          </p>
          {financiable && (
            <Link
              href="/preapproval"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
            >
              Precalificate para un crédito
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
