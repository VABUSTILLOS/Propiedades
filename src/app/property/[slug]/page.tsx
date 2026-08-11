import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getListingBySlug } from "@/modules/listings/queries";
import { getCurrentUser } from "@/modules/auth/session";
import { getBenchmark } from "@/modules/market-data/queries";
import { InquireButton } from "@/modules/transactions/components/inquire-button";
import { MarketPanel } from "@/modules/market-data/components/market-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  return { title: listing?.title ?? "Property" };
}

export default async function PropertyDetailPage({ params }: Props) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);

  if (!listing) {
    notFound();
  }

  const user = await getCurrentUser();
  const canInquire = Boolean(user && user.id !== listing.owner_id);

  const benchmark = await getBenchmark(listing.city, listing.colonia);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{listing.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {listing.address} · {listing.colonia}, {listing.city}, {listing.state}
          </p>
        </div>
        <Badge variant={listing.type === "rent" ? "secondary" : "default"}>
          {listing.type === "rent" ? "For rent" : "For sale"}
        </Badge>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          {listing.images && listing.images.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {listing.images.slice(0, 4).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={listing.title}
                  className="aspect-[4/3] w-full rounded-lg object-cover"
                />
              ))}
            </div>
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              No photos yet
            </div>
          )}

          {listing.description && (
            <p className="mt-6 whitespace-pre-line text-muted-foreground">
              {listing.description}
            </p>
          )}
        </section>

        <aside className="space-y-4">
          {canInquire && (
            <Card>
              <CardContent className="pt-6">
                <InquireButton propertyId={listing.id} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Price</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ${listing.price.toLocaleString()}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {listing.currency}
                </span>
              </p>
              {listing.precio_m2_const != null && (
                <p className="mt-1 text-sm text-muted-foreground">
                  ~$ {listing.precio_m2_const.toLocaleString()} / m² construido
                </p>
              )}
            </CardContent>
          </Card>

          <MarketPanel property={listing} benchmark={benchmark} />

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
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
