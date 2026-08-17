import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireRole } from "@/modules/auth/session";
import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Em } from "@/components/layout/emphasis";
import { buttonVariants } from "@/components/ui/button";
import {
  getAdminPropertyById,
  type AdminPropertyRow,
} from "@/modules/admin/queries";
import { ListingWizard } from "@/modules/listings/components/listing-wizard";

export const metadata: Metadata = { title: "Editar propiedad" };

export const dynamic = "force-dynamic";

/**
 * Master-user edit surface. Hydrates the same five-step wizard the owner
 * uses, seeded with the saved row so any publication (regardless of owner)
 * can be edited. Server actions allow admins past the owner check, matching
 * the "Admins manage all properties" RLS policy (migration 051).
 */
export default async function AdminEditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin"]);

  const { id } = await params;
  const property = await getAdminPropertyById(id);
  if (!property) notFound();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Master"
        title={
          <>
            Editar <Em>propiedad</Em>
          </>
        }
        description={property.title}
        actions={
          <Link
            href="/admin/propiedades"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <ArrowLeft className="size-4" />
            Volver al panel
          </Link>
        }
      />

      <div className="mt-8">
        <ListingWizard
          initialListing={{
            id: property.id,
            slug: property.slug,
            data: toWizardData(property),
          }}
        />
      </div>
    </PageShell>
  );
}

/** Map a saved property row onto the wizard form's string-based shape. */
function toWizardData(p: AdminPropertyRow) {
  return {
    title: p.title,
    type: p.type,
    category: p.category,
    dealType: p.deal_type,
    description: p.description ?? "",
    price: p.price != null ? String(p.price) : "",
    currency: p.currency,
    terreno_m2: p.terreno_m2 != null ? String(p.terreno_m2) : "",
    construccion_m2: p.construccion_m2 != null ? String(p.construccion_m2) : "",
    costo_reparacion_estimado:
      p.costo_reparacion_estimado != null
        ? String(p.costo_reparacion_estimado)
        : "",
    valor_post_reparacion_estimado:
      p.valor_post_reparacion_estimado != null
        ? String(p.valor_post_reparacion_estimado)
        : "",
    institucion_bancaria: p.institucion_bancaria ?? "",
    fecha_remate: p.fecha_remate ?? "",
    condiciones_traspaso: p.condiciones_traspaso ?? "",
    address: p.address ?? "",
    colonia: p.colonia ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    zip_code: p.zip_code ?? "",
    lat: p.lat != null ? String(p.lat) : "",
    lng: p.lng != null ? String(p.lng) : "",
    images: (p.images ?? []).map((url, index) => ({ id: String(index), url })),
    tour_360_url: p.tour_360_url ?? "",
    video_url: p.video_url ?? "",
    contact_name: p.contact_name ?? "",
    contact_type: p.contact_type ?? "",
    contact_phone: p.contact_phone ?? "",
    contact_whatsapp: p.contact_whatsapp ?? "",
    contact_email: p.contact_email ?? "",
    // Step 6 — "Campos avanzados".
    recamaras: p.recamaras != null ? String(p.recamaras) : "",
    banos: p.banos != null ? String(p.banos) : "",
    estacionamientos: p.estacionamientos != null ? String(p.estacionamientos) : "",
    antiguedad: p.antiguedad != null ? String(p.antiguedad) : "",
    precio_m2_const: p.precio_m2_const != null ? String(p.precio_m2_const) : "",
    precio_m2_terreno:
      p.precio_m2_terreno != null ? String(p.precio_m2_terreno) : "",
    valor_avaluo: p.valor_avaluo != null ? String(p.valor_avaluo) : "",
    porcentaje_descuento_avaluo:
      p.porcentaje_descuento_avaluo != null
        ? String(p.porcentaje_descuento_avaluo)
        : "",
    estimated_monthly_rent:
      p.estimated_monthly_rent != null ? String(p.estimated_monthly_rent) : "",
    cap_rate_projected:
      p.cap_rate_projected != null ? String(p.cap_rate_projected) : "",
    hoa_fee: p.hoa_fee != null ? String(p.hoa_fee) : "",
    predial_anual: p.predial_anual != null ? String(p.predial_anual) : "",
    property_score: p.property_score != null ? String(p.property_score) : "",
    noise_score: p.noise_score != null ? String(p.noise_score) : "",
    flood_risk_level: p.flood_risk_level ?? "",
    is_top: p.is_top == null ? "" : String(p.is_top),
    is_mls: p.is_mls == null ? "" : String(p.is_mls),
    commission_split: p.commission_split ?? "",
    private_notes: p.private_notes ?? "",
    source_url: p.source_url ?? "",
    amenidades: Array.isArray(p.amenidades)
      ? (p.amenidades as unknown[]).filter((a): a is string => typeof a === "string").join(", ")
      : "",
    status: p.status,
  };
}
