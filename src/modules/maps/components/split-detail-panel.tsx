"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Bath,
  BedDouble,
  Building2,
  CalendarClock,
  Car,
  LandPlot,
  ListPlus,
  MapPin,
  Ruler,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/ui/score-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WhatsAppInquiryButton } from "@/modules/chat/components/whatsapp-inquiry-button";
import { ShareWhatsAppButton } from "@/modules/chat/components/share-whatsapp-button";
import { SaveFavoriteButton } from "@/modules/favorites/components/save-favorite-button";
import { AddToListDialog } from "@/modules/favorites/components/add-to-list-dialog";
import { InquireButton } from "@/modules/transactions/components/inquire-button";
import { PropertyPhotoGallery } from "@/modules/property-gallery/components/property-photo-gallery";
import { PropertyViewToggle } from "@/modules/market-data/components/property-view-toggle";
import { MortgageCalculator } from "@/modules/listings/components/mortgage-calculator";
import { HotnessGauge } from "@/modules/market-data/components/hotness-gauge";
import { PropertyCard } from "@/modules/home/components/property-card";
import type { ListingWithHot } from "@/modules/search/queries";
import type {
  MarketBenchmarksRow,
  PropertiesRow,
} from "@/modules/lib/database.types";
import type { FavoriteListWithMeta } from "@/modules/favorites/lists-queries";
import {
  estimateEscrituracion,
  estimatePredial,
  formatMxn,
  isFinanciable,
} from "@/modules/lib/real-estate";
import { cn } from "@/lib/utils";

/** Server-derived extras from `GET /api/properties/[slug]/panel`. */
type PanelData = {
  benchmark: MarketBenchmarksRow | null;
  discountPct: number | null;
  hotScore: number | null;
  canInquire: boolean;
  isSaved: boolean;
  lists: FavoriteListWithMeta[];
  containingListIds: string[];
  similar: PropertiesRow[];
};

/**
 * Compact mirror of the full `/property/[slug]` page that replaces the
 * results list in the left pane of the split view, so the map stays visible
 * (and sticky) on the right. All sections of the full page are present —
 * gallery, price analysis, actions, contact, description, residence/investor
 * views, mortgage calculator, details and similar properties — stacked in a
 * single scrollable column. The "Ubicación" section is covered by the sticky
 * map, which pans/zooms to the selected listing.
 */
export function SplitDetailPanel({
  listing,
  onClose,
  className,
}: {
  listing: ListingWithHot;
  /** Clears the selection and restores the results list. */
  onClose: () => void;
  className?: string;
}) {
  const [data, setData] = useState<PanelData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/properties/${listing.slug}/panel`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`panel ${res.status}`);
        const json = (await res.json()) as PanelData;
        if (!cancelled) setData(json);
      } catch {
        // The panel still works without the server extras: favorite/list and
        // inquiry actions plus the market analysis simply stay hidden.
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listing.slug]);

  // Land (terreno) is inferred: no constructed area, but plot area present.
  const isLand = listing.terreno_m2 > 0 && listing.construccion_m2 === 0;

  const typeLabel = isLand
    ? "Tierra"
    : listing.type === "rent"
      ? "Renta"
      : "Venta";

  const price =
    listing.price > 0
      ? `$${listing.price.toLocaleString()} ${listing.currency ?? "MXN"}`
      : "Precio por cotizar";

  const location = [
    listing.address,
    listing.colonia,
    listing.city,
    listing.state,
  ]
    .filter(Boolean)
    .join(", ");

  const discountPct = data?.discountPct ?? listing.discountPct;
  const hotScore = data?.hotScore ?? listing.hotScore;
  const showCosts = listing.type === "sale" && listing.price > 0;
  const financiable = isFinanciable(listing.deal_type);

  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-background", className)}>
      <PropertyPhotoGallery
        images={listing.images ?? []}
        title={listing.title}
      />

      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-full text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver a resultados
          </button>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge className="rounded-full shadow-sm">{typeLabel}</Badge>
            <ScoreBadge
              score={listing.property_score}
              solid
              className="rounded-full shadow-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-bold leading-snug">{listing.title}</h3>
          <p className="inline-flex items-start gap-1 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{location}</span>
          </p>
        </div>

        {/* Precio + análisis (mirrors the full page's price card). */}
        <section aria-label="Precio" className="space-y-3">
          <p className="text-2xl font-bold">{price}</p>
          {discountPct != null && (
            <div
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                discountPct >= 0
                  ? "bg-emerald-600/10 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:text-amber-400",
              )}
            >
              {discountPct >= 0 ? (
                <>
                  <ArrowDownRight className="size-3.5" aria-hidden="true" />
                  {discountPct.toFixed(1)}% vs. colonia
                </>
              ) : (
                <>
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  {Math.abs(discountPct).toFixed(1)}% arriba vs. colonia
                </>
              )}
            </div>
          )}
          {(listing.precio_m2_const != null ||
            listing.precio_m2_terreno != null) && (
            <div className="space-y-0.5 text-sm text-muted-foreground">
              {listing.precio_m2_const != null && (
                <p>
                  ~${listing.precio_m2_const.toLocaleString()} / m² construido
                </p>
              )}
              {listing.precio_m2_terreno != null && (
                <p>
                  ~${listing.precio_m2_terreno.toLocaleString()} / m² terreno
                </p>
              )}
            </div>
          )}

          {showCosts && (
            <dl className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Predial estimado (anual)
                </dt>
                <dd className="font-medium">
                  {formatMxn(estimatePredial(listing.price))}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Escrituración estimada
                </dt>
                <dd className="font-medium">
                  {formatMxn(estimateEscrituracion(listing.price))}
                </dd>
              </div>
            </dl>
          )}

          {hotScore != null && (
            <div className="rounded-xl border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Oportunidad</p>
                <span className="text-xs font-medium text-muted-foreground">
                  {hotScore}/100
                </span>
              </div>
              <HotnessGauge score={hotScore} />
              <dl className="mt-3 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <dt>Ahorro vs. colonia (50%)</dt>
                  <dd className="font-medium text-foreground">
                    {discountPct != null
                      ? `${discountPct.toFixed(1)}%`
                      : "Sin dato"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>$/m² construido (50%)</dt>
                  <dd className="font-medium text-foreground">
                    {listing.precio_m2_const != null
                      ? `$${listing.precio_m2_const.toLocaleString()}`
                      : listing.precio_m2_terreno != null
                        ? `$${listing.precio_m2_terreno.toLocaleString()}`
                        : "Sin dato"}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {financiable && showCosts && (
            <p className="text-xs text-muted-foreground">
              Esta propiedad acepta crédito hipotecario. Simula tu mensualidad
              en la calculadora de abajo.
            </p>
          )}
        </section>

        {(listing.recamaras != null ||
          listing.banos != null ||
          listing.estacionamientos != null ||
          listing.construccion_m2 > 0 ||
          isLand) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {listing.recamaras != null && (
              <span className="inline-flex items-center gap-1">
                <BedDouble className="size-4" aria-hidden="true" />
                {listing.recamaras} rec.
              </span>
            )}
            {listing.banos != null && (
              <span className="inline-flex items-center gap-1">
                <Bath className="size-4" aria-hidden="true" />
                {listing.banos} baños
              </span>
            )}
            {listing.estacionamientos != null && (
              <span className="inline-flex items-center gap-1">
                <Car className="size-4" aria-hidden="true" />
                {listing.estacionamientos} est.
              </span>
            )}
            {isLand ? (
              <span className="inline-flex items-center gap-1">
                <Ruler className="size-4" aria-hidden="true" />
                {listing.terreno_m2.toLocaleString()} m² terreno
              </span>
            ) : (
              listing.construccion_m2 > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Ruler className="size-4" aria-hidden="true" />
                  {listing.construccion_m2.toLocaleString()} m² constr.
                </span>
              )
            )}
          </div>
        )}

        {/* Acciones (mirrors the full page's sidebar actions). */}
        <section aria-label="Acciones" className="space-y-2">
          <WhatsAppInquiryButton
            title={listing.title}
            colonia={listing.colonia}
            city={listing.city}
            className="w-full px-4 py-2.5 text-sm"
          />
          {data?.canInquire && (
            <InquireButton propertyId={listing.id} propertySlug={listing.slug} />
          )}
          {data ? (
            <>
              <SaveFavoriteButton
                propertyId={listing.id}
                propertySlug={listing.slug}
                initialSaved={data.isSaved}
              />
              <AddToListDialog
                propertyId={listing.id}
                propertySlug={listing.slug}
                lists={data.lists}
                containingListIds={data.containingListIds}
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full",
                })}
              >
                <ListPlus className="size-4" />
                Añadir a lista
              </AddToListDialog>
            </>
          ) : (
            !loadFailed && (
              <div
                className="h-10 animate-pulse rounded-md bg-muted"
                aria-hidden="true"
              />
            )
          )}
          <ShareWhatsAppButton
            property={{
              title: listing.title,
              colonia: listing.colonia,
              city: listing.city,
              price: listing.price,
              currency: listing.currency,
              slug: listing.slug,
            }}
            className="w-full"
          />
        </section>

        {listing.contact_name && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{listing.contact_name}</p>
              {listing.contact_type && (
                <p className="capitalize text-muted-foreground">
                  {listing.contact_type === "inmobiliaria"
                    ? "Inmobiliaria"
                    : listing.contact_type}
                </p>
              )}
              {listing.contact_phone && (
                <a
                  href={`tel:+52${listing.contact_phone}`}
                  className="block font-medium text-primary hover:underline"
                >
                  {formatPhoneDisplay(listing.contact_phone)}
                </a>
              )}
              {listing.contact_whatsapp && (
                <a
                  href={`https://wa.me/52${listing.contact_whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-medium text-primary hover:underline"
                >
                  Enviar WhatsApp
                </a>
              )}
              {listing.contact_email && (
                <a
                  href={`mailto:${listing.contact_email}`}
                  className="block font-medium text-primary hover:underline"
                >
                  {listing.contact_email}
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {listing.description && (
          <section aria-label="Descripción">
            <h4 className="mb-2 text-base font-semibold">Descripción</h4>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {listing.description}
            </p>
          </section>
        )}

        {data && (
          <PropertyViewToggle
            property={listing}
            benchmark={data.benchmark}
            discountPct={data.discountPct}
          />
        )}

        {showCosts && financiable && (
          <MortgageCalculator
            propertyId={listing.id}
            propertyTitle={listing.title}
            propertyPrice={listing.price}
          />
        )}

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Detalles</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <DetailRow
                icon={LandPlot}
                label={listing.category === "terreno" ? "m² lote" : "m² terreno"}
                value={`${listing.terreno_m2} m²`}
              />
              <DetailRow
                icon={Building2}
                label="m² construido"
                value={`${listing.construccion_m2} m²`}
              />
              {listing.recamaras != null && (
                <DetailRow
                  icon={BedDouble}
                  label="Recámaras"
                  value={String(listing.recamaras)}
                />
              )}
              {listing.banos != null && (
                <DetailRow
                  icon={Bath}
                  label="Baños"
                  value={String(listing.banos)}
                />
              )}
              {listing.estacionamientos != null && (
                <DetailRow
                  icon={Car}
                  label="Estacionamientos"
                  value={String(listing.estacionamientos)}
                />
              )}
              {listing.antiguedad != null && (
                <DetailRow
                  icon={CalendarClock}
                  label="Antigüedad"
                  value={`${listing.antiguedad} años`}
                />
              )}
              {listing.zip_code && (
                <DetailRow label="C.P." value={listing.zip_code} />
              )}
              <DetailRow
                label="Ubicación"
                value={`${listing.lat.toFixed(4)}, ${listing.lng.toFixed(4)}`}
              />
            </dl>
          </CardContent>
        </Card>

        {data && data.similar.length > 0 && (
          <section aria-label="Propiedades similares">
            <h4 className="mb-3 text-base font-semibold">
              Propiedades similares
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              {data.similar.map((item) => (
                <PropertyCard key={item.id} listing={item} />
              ))}
            </div>
          </section>
        )}

        <Link
          href={`/property/${listing.slug}`}
          className="inline-flex w-full items-center justify-center rounded-full bg-[#C4571D] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#D67E3C]"
        >
          Ver propiedad completa
        </Link>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {label}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/** Format a 10-digit MX phone as "614 252 3883" for display. */
function formatPhoneDisplay(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return phone;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}
