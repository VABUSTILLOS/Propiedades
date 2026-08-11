import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { getProfileBySubdomain } from "@/modules/profiles/queries";
import { parseBranding } from "@/modules/profiles/branding";
import { getActiveListingsByOwner } from "@/modules/listings/queries";
import type { Json } from "@/modules/lib/database.types";
import { Badge } from "@/components/ui/badge";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfileBySubdomain(slug);
  if (!profile) {
    return { title: "Agencia no encontrada" };
  }
  const branding = parseBranding(profile.branding_config);
  return {
    title: branding.company_name || profile.full_name,
    description: `Propiedades de ${branding.company_name || profile.full_name}`,
  };
}

export default async function AgencyPage({ params }: Props) {
  const { slug } = await params;
  const profile = await getProfileBySubdomain(slug);

  if (!profile) {
    notFound();
  }

  const branding = parseBranding(profile.branding_config);
  const listings = await getActiveListingsByOwner(profile.id);
  const agentName = branding.company_name || profile.full_name;

  return (
    <div className="min-h-screen">
      <header className="border-b" style={{ backgroundColor: branding.primary_color }}>
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              {agentName}
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {listings.length} propiedades activas · {profile.role}
            </p>
          </div>
          {branding.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logo_url}
              alt={`${agentName} logo`}
              className="h-12 w-auto rounded-md bg-white/10 object-contain p-1"
            />
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Propiedades en venta</h2>
          {branding.whatsapp_cta && (
            <a
              href={`https://wa.me/52${profile.phone ?? ""}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-[0.8rem] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <MessageCircle className="size-3.5" />
              {branding.whatsapp_cta}
            </a>
          )}
        </div>

        {listings.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              Esta agencia aún no publica propiedades.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <AgencyCard key={listing.id} {...listing} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function AgencyCard(listing: {
  id: string;
  slug: string;
  title: string;
  price: number;
  currency: string;
  type: "sale" | "rent";
  colonia: string;
  city: string;
  construccion_m2: number;
  images: Json;
}) {
  const image = Array.isArray(listing.images)
    ? listing.images[0]
    : undefined;

  return (
    <Link
      href={`/property/${listing.slug}`}
      className="group overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
    >
      {typeof image === "string" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={listing.title}
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
          Sin foto
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-lg">
            ${listing.price.toLocaleString()}
            <span className="text-xs font-normal text-muted-foreground">
              {" "}
              {listing.currency}
            </span>
          </p>
          <Badge variant={listing.type === "rent" ? "secondary" : "default"}>
            {listing.type === "rent" ? "Renta" : "Venta"}
          </Badge>
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {listing.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {listing.colonia}, {listing.city}
        </p>
      </div>
    </Link>
  );
}
