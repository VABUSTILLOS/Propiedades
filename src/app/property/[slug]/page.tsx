import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getListingBySlug } from "@/modules/listings/queries";
import { getCurrentUser } from "@/modules/auth/session";
import { isFavoriteSaved } from "@/modules/favorites/queries";
import { SaveFavoriteButton } from "@/modules/favorites/components/save-favorite-button";
import {
  getBenchmark,
  getColoniaDiscount,
} from "@/modules/market-data/queries";
import { InquireButton } from "@/modules/transactions/components/inquire-button";
import { PropertyViewToggle } from "@/modules/market-data/components/property-view-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/modules/home/components/site-header";
import { SiteFooter } from "@/modules/home/components/site-footer";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  return { title: listing?.title ?? "Property" };
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

  const benchmark = await getBenchmark(listing.city, listing.colonia);
  const discountPct = await getColoniaDiscount(listing.id);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={user} />

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
          <Badge
            variant={listing.type === "rent" ? "secondary" : "default"}
            className="rounded-full shadow-sm"
          >
            {listing.type === "rent" ? "En renta" : "En venta"}
          </Badge>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <section>
            <PropertyViewToggle
              property={listing}
              benchmark={benchmark}
              discountPct={discountPct}
              initialMode={mode}
            />
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
                {listing.precio_m2_const != null && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    ~${listing.precio_m2_const.toLocaleString()} / m² construido
                  </p>
                )}
                {listing.precio_m2_terreno != null && (
                  <p className="text-sm text-muted-foreground">
                    ~${listing.precio_m2_terreno.toLocaleString()} / m² terreno
                  </p>
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
