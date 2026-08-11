import { z } from "zod";
import {
  areaM2Schema,
  latSchema,
  lngSchema,
  mxnSchema,
} from "@/modules/lib/schemas";

/** POST /api/properties/import-universal body. */
export const importUrlSchema = z.object({
  url: z.string().trim().url("Must be a valid URL").max(2000),
});

/**
 * Draft payload accepted by the createImportedDraft server action.
 * Field names are the DB-facing names (address, not address_text).
 */
export const importedPropertyDraftSchema = z.object({
  title: z.string().trim().min(3).max(200),
  price: mxnSchema,
  currency: z.string().length(3).default("MXN"),
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
