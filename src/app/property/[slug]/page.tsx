import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Compass, ListPlus, PlayCircle } from "lucide-react";

import { getListingBySlug } from "@/modules/listings/queries";
import { getCurrentUser } from "@/modules/auth/session";
import { isEditorMode } from "@/modules/admin/editor-mode";
import { isFavoriteSaved } from "@/modules/favorites/queries";
import { getMyLists, getListsContainingProperty } from "@/modules/favorites/lists-queries";
import { SaveFavoriteButton } from "@/modules/favorites/components/save-favorite-button";
import { AddToListDialog } from "@/modules/favorites/components/add-to-list-dialog";
import { ShareWhatsAppButton } from "@/modules/chat/components/share-whatsapp-button";
import { WhatsAppInquiryButton } from "@/modules/chat/components/whatsapp-inquiry-button";
import {
  getBenchmark,
  getColoniaDiscount,
  toHotScore,
} from "@/modules/market-data/queries";
import { InquireButton } from "@/modules/transactions/components/inquire-button";
import { SimilarProperties } from "@/modules/listings/components/similar-properties";
import { PropertyViewToggle } from "@/modules/market-data/components/property-view-toggle";
import { PropertyPhotoGallery } from "@/modules/property-gallery/components/property-photo-gallery";
import { PropertyLocationMap } from "@/modules/maps/components/property-location-map";
import { PannellumViewer } from "@/modules/flyers/components/pannellum-viewer";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PropertyInlineEditor,
  type InlineListingData,
} from "@/modules/admin/components/property-inline-editor";
import { isFinanciable } from "@/modules/lib/real-estate";
import type { PropertiesRow } from "@/modules/lib/database.types";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) return { title: "Propiedad" };

  // WhatsApp/Telegram/social render a thumbnail card from these OG tags when
  // a property link is shared — without og:image the preview is bare text.
  const location = [listing.colonia, listing.city].filter(Boolean).join(", ");
  const description =
    `${location} · $${listing.price.toLocaleString("es-MX")} ` +
    `${listing.currency ?? "MXN"}`;
  const images = (listing.images ?? []).filter(Boolean).slice(0, 3);

  return {
    title: listing.title,
    description,
    openGraph: {
      title: listing.title,
      description,
      images,
    },
  };
}

export default async function PropertyDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);

  if (!listing) {
    notFound();
  }

  const raw = await searchParams;
  const mode = raw.mode === "investor" ? "inversionista" : "residencia";

  // Return to the exact listados/search view the user came from (passed as a
  // `from` query param by the result cards), falling back to /search.
  const from =
    typeof raw.from === "string" && isSafeBackHref(raw.from)
      ? raw.from
      : "/search";

  const user = await getCurrentUser();
  const editorMode = await isEditorMode();
  const canInquire = user?.id !== listing.owner_id;
  const isSaved = user ? await isFavoriteSaved(user.id, listing.id) : false;
  const lists = user ? await getMyLists(user.id) : [];
  const containingListIds = user
    ? await getListsContainingProperty(user.id, listing.id)
    : [];

  const benchmark = await getBenchmark(listing.city, listing.colonia);
  const discountPct = await getColoniaDiscount(listing.id);
  const hotScore = toHotScore(discountPct, listing);
  const videoUrl =
    listing.video_url ??
    listing.generated_video_url ??
    listing.generated_video_vertical_url;
  const tourUrl =
    listing.tour_360_url &&
    (listing.tour_360_url !== listing.generated_tour_url ||
      listing.generated_tour_type === "panorama_360")
      ? listing.tour_360_url
      : null;
  const hasMedia = Boolean(videoUrl || tourUrl);
  const mediaSectionTitle =
    videoUrl && tourUrl ? "Video y tour 360" : videoUrl ? "Video" : "Tour 360";

  const financiable = isFinanciable(listing.deal_type);
  const canEdit = user?.role === "admin";
  const showOwnerEditLink = user?.id === listing.owner_id && user.role !== "admin";

  return (
    <PropertyInlineEditor
      listing={toInlineListingData(listing)}
      canEdit={canEdit}
      editorMode={editorMode}
      showOwnerEditLink={showOwnerEditLink}
      from={from}
      discountPct={discountPct}
      hotScore={hotScore}
      financiable={financiable}
      gallery={
        <div className="space-y-3">
          <PropertyPhotoGallery
            images={listing.images ?? []}
            title={listing.title}
          />
          {listing.source_url && (
            <p className="text-sm text-muted-foreground">
              Fotos obtenidas de{" "}
              <a
                href={listing.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Vivanuncios
              </a>{" "}
              · Ver{" "}
              <a
                href={listing.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                anuncio original
              </a>
            </p>
          )}
        </div>
      }
      map={
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
      }
      media={
        hasMedia ? (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{mediaSectionTitle}</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {videoUrl && (
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <PlayCircle className="size-5 text-primary" />
                      Video
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <video
                      src={videoUrl}
                      controls
                      preload="metadata"
                      playsInline
                      className="aspect-video w-full rounded-xl border bg-black"
                    />
                  </CardContent>
                </Card>
              )}

              {tourUrl && (
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Compass className="size-5 text-primary" />
                      Tour 360°
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PannellumViewer url={tourUrl} title={listing.title} />
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        ) : null
      }
      viewToggle={
        <PropertyViewToggle
          property={listing}
          benchmark={benchmark}
          discountPct={discountPct}
          initialMode={mode}
        />
      }
      similar={<SimilarProperties listing={listing} />}
      asideCtas={
        <>
          <WhatsAppInquiryButton
            title={listing.title}
            colonia={listing.colonia}
            city={listing.city}
            className="w-full px-4 py-3"
          />

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
        </>
      }
      mobileCta={
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:hidden">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
            <p className="min-w-0 truncate text-lg font-bold">
              ${listing.price.toLocaleString()}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {listing.currency}
              </span>
            </p>
            <WhatsAppInquiryButton
              title={listing.title}
              colonia={listing.colonia}
              city={listing.city}
              label="Preguntar"
              className="shrink-0 px-5 py-2.5 text-sm"
            />
          </div>
        </div>
      }
    />
  );
}

function toInlineListingData(listing: PropertiesRow): InlineListingData {
  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    type: listing.type,
    category: listing.category,
    deal_type: listing.deal_type,
    status: listing.status,
    description: listing.description,
    address: listing.address,
    colonia: listing.colonia,
    city: listing.city,
    state: listing.state,
    zip_code: listing.zip_code,
    lat: listing.lat,
    lng: listing.lng,
    price: listing.price,
    currency: listing.currency,
    terreno_m2: listing.terreno_m2,
    construccion_m2: listing.construccion_m2,
    precio_m2_const: listing.precio_m2_const,
    precio_m2_terreno: listing.precio_m2_terreno,
    recamaras: listing.recamaras,
    banos: listing.banos,
    estacionamientos: listing.estacionamientos,
    antiguedad: listing.antiguedad,
    contact_name: listing.contact_name,
    contact_type: listing.contact_type,
    contact_phone: listing.contact_phone,
    contact_whatsapp: listing.contact_whatsapp,
    contact_email: listing.contact_email,
    property_score: listing.property_score,
    noise_score: listing.noise_score,
    flood_risk_level: listing.flood_risk_level,
    is_top: listing.is_top,
    is_mls: listing.is_mls,
    commission_split: listing.commission_split,
    private_notes: listing.private_notes,
    source_url: listing.source_url,
    video_url: listing.video_url,
    tour_360_url: listing.tour_360_url,
    amenidades: Array.isArray(listing.amenidades)
      ? (listing.amenidades as unknown[])
          .filter((a): a is string => typeof a === "string")
      : [],
    images: listing.images ?? [],
    costo_reparacion_estimado: listing.costo_reparacion_estimado,
    valor_post_reparacion_estimado: listing.valor_post_reparacion_estimado,
    institucion_bancaria: listing.institucion_bancaria,
    fecha_remate: listing.fecha_remate,
    condiciones_traspaso: listing.condiciones_traspaso,
  };
}

/**
 * Only accept same-site relative paths for the back link (never `//host` or
 * absolute URLs) so the `from` query param can't be used as an open redirect.
 */
function isSafeBackHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//") && !href.includes(":");
}
