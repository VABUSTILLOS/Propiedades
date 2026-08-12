import { z } from "zod";
import {
  areaM2Schema,
  latSchema,
  lngSchema,
  mxnSchema,
  propertyCategorySchema,
  propertyDealTypeSchema,
} from "@/modules/lib/schemas";

/** POST /api/properties/import-universal body. */
export const importUrlSchema = z.object({
  url: z.string().trim().url("Debe ser una URL válida").max(2000),
  /**
   * Optional captured page content (text or raw HTML) copied from the user's
   * logged-in browser. Facebook Marketplace blocks server-side scraping, so
   * when the user pastes the listing from their own (authenticated) browser
   * session we use this instead of fetching the URL.
   */
  content: z.string().max(2_000_000).optional(),
});

/**
 * Draft payload accepted by the createImportedDraft server action.
 * Field names are the DB-facing names (address, not address_text).
 */
export const importedPropertyDraftSchema = z.object({
  title: z.string().trim().min(3).max(200),
  price: mxnSchema,
  currency: z.string().length(3).default("MXN"),
  category: propertyCategorySchema.default("casa"),
  deal_type: propertyDealTypeSchema.default("venta_directa"),
  costo_reparacion_estimado: mxnSchema.nullable().default(null),
  valor_post_reparacion_estimado: mxnSchema.nullable().default(null),
  institucion_bancaria: z.string().trim().max(120).nullable().default(null),
  fecha_remate: z.string().date().nullable().default(null),
  condiciones_traspaso: z.string().trim().max(2000).nullable().default(null),
  terreno_m2: areaM2Schema,
  construccion_m2: areaM2Schema,
  description: z.string().max(5000).default(""),
  address: z.string().trim().max(200).default(""),
  colonia: z.string().trim().max(100).default(""),
  city: z.string().trim().max(100).default(""),
  state: z.string().trim().max(100).default(""),
  zip_code: z.string().max(10).nullable().default(null),
  lat: latSchema,
  lng: lngSchema,
  images: z.array(z.string().url()).max(50).default([]),
  bento_highlights: z.array(z.string().max(140)).max(6).default([]),
  source_url: z.string().url(),
});

export type ImportedPropertyDraft = z.infer<typeof importedPropertyDraftSchema>;
