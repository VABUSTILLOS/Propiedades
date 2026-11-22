"use client";

import { Heart } from "lucide-react";

import { SearchResultCard } from "@/modules/maps/components/search-result-card";
import { useCardDetailsPref } from "@/modules/maps/components/infinite-listings";
import type { ListingWithHot } from "@/modules/search/queries";

/**
 * «Favoritas» — the signed-in user's hearted properties, shown as their
 * own section at the top of Comprar (Victor's ask, 2026-11-22). The
 * page only renders this when the user has at least one active sale
 * favorite; cards are the same SearchResultCard the results grid uses,
 * in the user's own tier order from getMyFavorites.
 */
export function FavoritesSection({ items }: { items: ListingWithHot[] }) {
  const showDetails = useCardDetailsPref();

  if (items.length === 0) return null;

  return (
    <section aria-label="Favoritas" className="mb-10">
      <div className="mb-4 flex items-center gap-2">
        <Heart className="size-5 fill-red-500 text-red-500" aria-hidden />
        <h2 className="text-xl font-bold tracking-tight">Favoritas</h2>
        <span className="text-sm text-muted-foreground">
          {items.length} propiedad{items.length === 1 ? "" : "es"}
        </span>
      </div>
      <div className="grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <SearchResultCard
            key={item.id}
            propertyId={item.id}
            saved
            title={item.title}
            slug={item.slug}
            city={`${item.colonia}, ${item.city}`}
            price={item.price}
            currency={item.currency}
            type={item.type}
            image={item.images?.[0] ?? null}
            images={item.images ?? []}
            videoUrl={
              item.video_url ??
              item.generated_video_url ??
              item.generated_video_vertical_url
            }
            score={item.property_score}
            hotScore={item.hotScore}
            discountPct={item.discountPct}
            construccionM2={item.construccion_m2}
            terrenoM2={item.terreno_m2}
            showDetails={showDetails}
            dealType={item.deal_type}
            investmentKpis={{
              dealType: item.deal_type,
              price: item.price,
              costoReparacion: item.costo_reparacion_estimado,
              valorPostReparacion: item.valor_post_reparacion_estimado,
              institucionBancaria: item.institucion_bancaria,
              fechaRemate: item.fecha_remate,
              condicionesTraspaso: item.condiciones_traspaso,
              capRate: item.cap_rate_projected,
              rentaEstimada: item.estimated_monthly_rent,
              discountAvaluo: item.porcentaje_descuento_avaluo,
            }}
          />
        ))}
      </div>
    </section>
  );
}
