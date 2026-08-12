import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, ListPlus } from "lucide-react";

import { getListingBySlug } from "@/modules/listings/queries";
import { getCurrentUser } from "@/modules/auth/session";
import { isFavoriteSaved } from "@/modules/favorites/queries";
import { getMyLists, getListsContainingProperty } from "@/modules/favorites/lists-queries";
import { SaveFavoriteButton } from "@/modules/favorites/components/save-favorite-button";
import { AddToListDialog } from "@/modules/favorites/components/add-to-list-dialog";
import { ShareWhatsAppButton } from "@/modules/chat/components/share-whatsapp-button";
import {
  getBenchmark,
  getColoniaDiscount,
  toHotScore,
} from "@/modules/market-data/queries";
import { InquireButton } from "@/modules/transactions/components/inquire-button";
import { PropertyViewToggle } from "@/modules/market-data/components/property-view-toggle";
import { PropertyLocationMap } from "@/modules/maps/components/property-location-map";
import { HotnessGauge } from "@/modules/market-data/components/hotness-gauge";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/ui/score-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  estimateEscrituracion,
  estimatePredial,
  formatMxn,
  isFinanciable,
} from "@/modules/lib/real-estate";
import { SiteFooter } from "@/modules/home/components/site-footer";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  return { title: listing?.title ?? "Propiedad" };
}

export default async function PropertyDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);

  if (!listing) {
    notFound();
  }

  const raw = await searchParams;
  const mode = raw.mode === "investor" ? "inversionista" : "residencia";

  const user = await getCurrentUser();
  const canInquire = user?.id !== listing.owner_id;
  const isSaved = user ? await isFavoriteSaved(user.id, listing.id) : false;
  const lists = user ? await getMyLists(user.id) : [];
  const containingListIds = user
    ? await getListsContainingProperty(user.id, listing.id)
    : [];

  const benchmark = await getBenchmark(listing.city, listing.colonia);
  const discountPct = await getColoniaDiscount(listing.id);
  const hotScore = toHotScore(discountPct, listing);

  const showCosts = listing.type === "sale" && listing.price > 0;
  const financiable = isFinanciable(listing.deal_type);

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <Link
          href="/search"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a propiedades
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{listing.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {listing.address} · {listing.colonia}, {listing.city}, {listing.state}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={listing.type === "rent" ? "secondary" : "default"}
              className="rounded-full shadow-sm"
            >
              {listing.type === "rent" ? "En renta" : "En venta"}
            </Badge>
            <ScoreBadge
              score={listing.property_score}
              className="rounded-full shadow-sm"
            />
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <section className="space-y-8">
            <PropertyViewToggle
              property={listing}
              benchmark={benchmark}
              discountPct={discountPct}
              initialMode={mode}
            />

            <div>
              <h2 className="mb-3 text-lg font-semibold">Ubicación</h2>
              <PropertyLocationMap
                lat={listing.lat}
                lng={listing.lng}
                title={listing.title}
                price={listing.price}
                type={listing.type}
                address={listing.address}
              />
            </div>
          </section>

          <aside className="space-y-4">
            {canInquire && (
              <Card className="rounded-2xl">
                <CardContent className="pt-6">
                  <InquireButton propertyId={listing.id} propertySlug={slug} />
                </CardContent>
              </Card>
            )}

            <SaveFavoriteButton
              propertyId={listing.id}
              propertySlug={slug}
              initialSaved={isSaved}
            />

            <AddToListDialog
              propertyId={listing.id}
              propertySlug={slug}
              lists={lists}
              containingListIds={containingListIds}
              className={buttonVariants({
                variant: "outline",
                className: "w-full",
              })}
            >
              <ListPlus className="size-4" />
              Añadir a lista
            </AddToListDialog>

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

            <Card className="sticky top-24 rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Precio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  ${listing.price.toLocaleString()}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {listing.currency}
                  </span>
                </p>
                {discountPct != null && (
                  <div
                    className={cn(
                      "mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                      discountPct >= 0
                        ? "bg-emerald-600/10 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:text-amber-400",
                    )}
                  >
                    {discountPct >= 0 ? (
                      <>
                        <ArrowDownRight className="size-3.5" />
                        {discountPct.toFixed(1)}% vs. colonia
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="size-3.5" />
                        {Math.abs(discountPct).toFixed(1)}% arriba vs. colonia
                      </>
                    )}
                  </div>
                )}
                {listing.precio_m2_const != null && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    ~${listing.precio_m2_const.toLocaleString()} / m² construido
                  </p>
                )}
                {listing.precio_m2_terreno != null && (
                  <p className="text-sm text-muted-foreground">
                    ~${listing.precio_m2_terreno.toLocaleString()} / m² terreno
                  </p>
                )}

                {showCosts && (
                  <dl className="mt-4 space-y-1 border-t pt-3 text-sm">
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
                  <div className="mt-4 rounded-xl border bg-card p-3">
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

                {financiable && (
                  <Link
                    href="/preapproval"
                    className={buttonVariants({
                      className: "mt-4 w-full",
                    })}
                  >
                    Precalificate para un crédito
                  </Link>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Detalles</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <DetailRow label="Terreno" value={`${listing.terreno_m2} m²`} />
                  <DetailRow
                    label="Construcción"
                    value={`${listing.construccion_m2} m²`}
                  />
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
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
