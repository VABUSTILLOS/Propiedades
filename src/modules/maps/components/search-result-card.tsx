"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/ui/score-badge";
import { ArrowDownRight, ArrowUpRight, Video } from "lucide-react";
import { PropertyEditLink } from "@/modules/admin/components/edit-link";
import { HotnessGauge } from "@/modules/market-data/components/hotness-gauge";
import {
  DealTypeBadge,
  DEAL_THRESHOLD_PCT,
  InvestmentKpis,
  type InvestmentKpisData,
} from "@/modules/market-data/components/investment-kpis";
import {
  estimateEscrituracion,
  estimatePredial,
  formatMxn,
  getPrecioM2Const,
  getPrecioM2Terreno,
  propertyTypeLabel,
} from "@/modules/lib/real-estate";
import type { PropertyDealType } from "@/modules/lib/database.types";

/**
 * Search result card used by the infinite list and the map-zone grid.
 * Pure presentational; the favorite bookmark is a separate client component.
 *
 * `showDetails` reveals the optional financial details (predial est.,
 * escrituración est., barra hot, $/m², % descuento vs colonia) that the
 * listing pages toggle on/off.
 */
export function SearchResultCard({
  title,
  slug,
  city,
  price,
  currency,
  type,
  image,
  videoUrl = null,
  score,
  hotScore = null,
  discountPct = null,
  construccionM2 = 0,
  terrenoM2 = 0,
  showDetails = false,
  from,
  dealType = null,
  investmentKpis = null,
  editHref,
}: {
  title: string;
  slug: string;
  city: string;
  price: number;
  currency: string;
  type: "sale" | "rent";
  image: string | null;
  videoUrl?: string | null;
  score: number | null;
  /** Hotness 0–100 for the traffic-light gauge (only when showDetails). */
  hotScore?: number | null;
  /** Percent below (positive) or above (negative) the colonia benchmark. */
  discountPct?: number | null;
  construccionM2?: number;
  terrenoM2?: number;
  /** Whether to render the extra financial details on the card. */
  showDetails?: boolean;
  /** Full URL of the current list/search view so the detail page can link back. */
  from?: string;
  /** Deal type badge shown on every card (remate/flipping/traspaso/…). */
  dealType?: PropertyDealType | null;
  /** Investment KPIs rendered below the price when the row carries them. */
  investmentKpis?: InvestmentKpisData | null;
  /** Master-user editor mode: link to the admin edit wizard. */
  editHref?: string;
}) {
  const m2Metrics = {
    price,
    construccion_m2: construccionM2,
    terreno_m2: terrenoM2,
    precio_m2_const: null,
    precio_m2_terreno: null,
  };
  const precioM2Const = getPrecioM2Const(m2Metrics) ?? 0;
  const precioM2Terreno = getPrecioM2Terreno(m2Metrics) ?? 0;
  const href = from
    ? `/property/${slug}?from=${encodeURIComponent(from)}`
    : `/property/${slug}`;
  return (
    <div className="group relative block motion-safe:transition-all motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md">
      <Link href={href} className="block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
          {videoUrl ? (
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={image ?? undefined}
              src={videoUrl}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              loading="lazy"
              decoding="async"
              src={image}
              alt={title}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted text-xs text-muted-foreground">
              Sin foto
            </div>
          )}
          {videoUrl && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
          )}
          <div className="absolute left-3 top-3 flex gap-2">
            <Badge className="rounded-full shadow-sm">
              {propertyTypeLabel(type)}
            </Badge>
            {videoUrl && (
              <Badge variant="secondary" className="rounded-full shadow-sm">
                <Video className="size-3.5" aria-hidden="true" />
                Video
              </Badge>
            )}
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

          {(dealType || investmentKpis) && (
            <div className="space-y-1.5 border-t pt-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {dealType && <DealTypeBadge dealType={dealType} />}
                {(discountPct ?? 0) >= DEAL_THRESHOLD_PCT && (
                  <Badge
                    variant="outline"
                    className="text-emerald-700 dark:text-emerald-400"
                  >
                    Oportunidad
                  </Badge>
                )}
              </div>
              {investmentKpis && <InvestmentKpis item={investmentKpis} />}
            </div>
          )}

          {showDetails && price > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              <HotnessGauge score={hotScore ?? null} />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">Predial est.</dt>
                  <dd className="font-medium">
                    {formatMxn(estimatePredial(price))}
                    <span className="text-muted-foreground">/año</span>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">Escrituración est.</dt>
                  <dd className="font-medium">
                    {formatMxn(estimateEscrituracion(price))}
                  </dd>
                </div>
                {precioM2Const > 0 && (
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">$/m² constr.</dt>
                    <dd className="font-medium">
                      ${Math.round(precioM2Const).toLocaleString()}
                    </dd>
                  </div>
                )}
                {precioM2Terreno > 0 && (
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">$/m² terreno</dt>
                    <dd className="font-medium">
                      ${Math.round(precioM2Terreno).toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
              {discountPct != null && (
                <p className="inline-flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  Descuento vs colonia:
                  {discountPct >= 0 ? (
                    <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-700 dark:text-emerald-400">
                      <ArrowDownRight className="size-3.5" aria-hidden="true" />
                      {discountPct.toFixed(1)}% abajo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 font-semibold text-amber-700 dark:text-amber-400">
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      {Math.abs(discountPct).toFixed(1)}% arriba
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      </Link>
      {editHref && <PropertyEditLink href={editHref} />}
    </div>
  );
}
