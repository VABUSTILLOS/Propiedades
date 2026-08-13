"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Bath,
  BedDouble,
  ExternalLink,
  MapPin,
  Ruler,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/ui/score-badge";
import { HotnessGauge } from "@/modules/market-data/components/hotness-gauge";
import {
  estimateEscrituracion,
  estimatePredial,
  formatMxn,
} from "@/modules/lib/real-estate";

/** Minimal shape shared by the search list and investor opportunity cards. */
export type PropertyDetailPanelItem = {
  slug: string;
  title: string;
  city: string;
  colonia: string;
  price: number;
  currency: string;
  type?: "sale" | "rent";
  image: string | null;
  recamaras: number | null;
  banos?: number | null;
  construccion_m2: number;
  terreno_m2: number;
  score?: number | null;
  hotScore?: number | null;
  discountPct?: number | null;
};

/**
 * Detail preview shown in the left pane of the split view when a listing is
 * chosen from the list. Keeps the map open (zoomed to the property) and offers
 * two exits: back to the results, or the full property page.
 */
export function PropertyDetailPanel({
  item,
  onBack,
}: {
  item: PropertyDetailPanelItem;
  onBack: () => void;
}) {
  const isLand = item.terreno_m2 > 0 && item.construccion_m2 === 0;
  const typeLabel = item.type === "rent" ? "Renta" : isLand ? "Tierra" : "Venta";
  const discount = item.discountPct;

  return (
    <div className="overflow-hidden rounded-2xl border bg-background">
      <div className="relative">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.title}
            className="aspect-[4/3] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-xs text-muted-foreground">
            Sin foto
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge className="rounded-full shadow-sm">{typeLabel}</Badge>
        </div>
        <ScoreBadge
          score={item.score ?? null}
          solid
          className="absolute right-3 top-3 rounded-full"
        />
        <button
          type="button"
          onClick={onBack}
          className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:bg-background"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Regresar a resultados
        </button>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-lg font-semibold leading-snug">{item.title}</h3>
          <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-1">
              {[item.colonia, item.city].filter(Boolean).join(", ")}
            </span>
          </p>
        </div>

        <p className="text-xl font-bold">
          ${item.price.toLocaleString()}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {item.currency} · {item.type === "rent" ? "renta" : "venta"}
          </span>
        </p>

        {(item.recamaras != null ||
          item.banos != null ||
          item.construccion_m2 > 0 ||
          isLand) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {item.recamaras != null && (
              <span className="inline-flex items-center gap-1">
                <BedDouble className="size-4" aria-hidden="true" />
                {item.recamaras}
              </span>
            )}
            {item.banos != null && (
              <span className="inline-flex items-center gap-1">
                <Bath className="size-4" aria-hidden="true" />
                {item.banos}
              </span>
            )}
            {isLand ? (
              <span className="inline-flex items-center gap-1">
                <Ruler className="size-4" aria-hidden="true" />
                {item.terreno_m2.toLocaleString()} m² terreno
              </span>
            ) : (
              item.construccion_m2 > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Ruler className="size-4" aria-hidden="true" />
                  {item.construccion_m2.toLocaleString()} m²
                </span>
              )
            )}
          </div>
        )}

        {item.hotScore != null && <HotnessGauge score={item.hotScore} />}

        {item.price > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Predial est.</dt>
              <dd className="font-medium">
                {formatMxn(estimatePredial(item.price))}
                <span className="text-muted-foreground">/año</span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Escrituración est.</dt>
              <dd className="font-medium">
                {formatMxn(estimateEscrituracion(item.price))}
              </dd>
            </div>
          </dl>
        )}

        {discount != null && (
          <p className="inline-flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            Descuento vs colonia:
            {discount >= 0 ? (
              <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600">
                <ArrowDownRight className="size-3.5" aria-hidden="true" />
                {discount.toFixed(1)}% abajo
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600">
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
                {Math.abs(discount).toFixed(1)}% arriba
              </span>
            )}
          </p>
        )}

        <Link
          href={`/property/${item.slug}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#C4571D] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#D67E3C]"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          Ver propiedad completa
        </Link>
      </div>
    </div>
  );
}
