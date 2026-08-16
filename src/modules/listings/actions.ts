"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/modules/auth/session";
import { chatCompletion } from "@/modules/ai/server";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { z } from "zod";

import { fail, failAuth, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import {
  propertyCategorySchema,
  propertyCreateSchema,
  propertyWizardStep1Schema,
  propertyWizardStep2Schema,
  propertyWizardStep3Schema,
  propertyWizardStep4Schema,
  propertyWizardStep5Schema,
  mortgageLeadSchema,
} from "@/modules/lib/schemas";
import type { PropertiesRow } from "@/modules/lib/database.types";
import { buildUniqueSlug } from "@/modules/listings/slug";
import { importedPropertyDraftSchema } from "@/modules/importer/schemas";

type WizardStep = 1 | 2 | 3 | 4 | 5;

/** Fixed exchange rate used to convert USD-denominated prices to MXN. */
const USD_TO_MXN_RATE = 17.5;
const IMAGE_BUCKET = "property-images";
const MAX_WIZARD_IMAGES = 50;
const MAX_WIZARD_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_WIZARD_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const wizardExtractionSchema = z.object({
  title: z.string().trim().min(3).max(200).nullable().optional(),
  type: z.enum(["sale", "rent"]).nullable().optional(),
  category: propertyCategorySchema.nullable().optional(),
  deal_type: z
    .enum(["venta_directa", "remate_bancario", "flipping", "traspaso", "renta"])
    .nullable()
    .optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  price: z.number().min(0).max(999_999_999_999).nullable().optional(),
  terreno_m2: z.number().min(0).max(10_000_000).nullable().optional(),
  construccion_m2: z.number().min(0).max(10_000_000).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  colonia: z.string().trim().max(100).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(100).nullable().optional(),
  zip_code: z.string().trim().max(10).nullable().optional(),
  contact_phone: z.string().trim().max(50).nullable().optional(),
  contact_whatsapp: z.string().trim().max(50).nullable().optional(),
  contact_email: z.string().trim().email().max(200).nullable().optional(),
});

export type WizardExtractedData = z.infer<typeof wizardExtractionSchema>;

function stripJsonFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return ((fenced && fenced[1]) ?? text).trim();
}

function imageExtForType(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

/** Parse "30,000" or "30.000" or "30000" to number. */
function parseMXN(text: string): number | null {
  const m = text.match(/(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)/);
  const value = m?.[1];
  if (!value) return null;
  const clean = value.replace(/[.,]/g, "");
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

/** Parse "Terreno 2500 mts" or "lote de 2,500 m2" to number for land area. */
function parseTerrenoM2(text: string): number | null {
  const m = text.match(
    /(?:terreno|superficie(?:\s+del\s+terreno)?|lote|solar)\D{0,40}(\d+(?:[.,]\d{3})*)\s*(?:m2|m²|mts?|metros)?/i,
  );
  const value = m?.[1];
  if (!value) return null;
  const clean = value.replace(/[.,]/g, "");
  const n = Number(clean);
  return Number.isFinite(n) && n > 0 && n < 10_000_000 ? n : null;
}

/** Parse construction area from text, e.g. "Oficina 36 mts con baño". */
function parseConstruccionM2(text: string): number | null {
  const m = text.match(
    /(?:construcci[oó]n|construido|construida|edificaci[oó]n|oficina|local|bodega|nave|casa|departamento)\D{0,40}(\d+(?:[.,]\d{3})*)\s*(?:m2|m²|mts?|metros)/i,
  );
  const value = m?.[1];
  if (!value) return null;
  const clean = value.replace(/[.,]/g, "");
  const n = Number(clean);
  return Number.isFinite(n) && n > 0 && n < 10_000_000 ? n : null;
}

/** Extract Mexican phone from text. */
function extractPhone(text: string): string | null {
  // Matches +52, 52, or bare 10-digit with common separators
  const m = text.match(
    /(?:\+?52\s?)?(?:\d{2,3}[\s.-]?)?(?:\d{3,4}[\s.-]?\d{4})/,
  );
  if (!m) return null;
  // Normalize to +52 XX XXXX XXXX
  const digits = m[0].replace(/\D/g, "");
  if (digits.length === 10) return `+52 ${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  if (digits.length === 12 && digits.startsWith("52"))
    return `+52 ${digits.slice(2, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
  return m[0];
}

/** Generate a concise title from text. */
function inferTitle(text: string): string | null {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const firstLine = lines.at(0);
  if (!firstLine) return null;
  const first = firstLine.slice(0, 80);
  return first || null;
}

/** Determine category from text hints. */
function inferCategory(text: string): WizardExtractedData["category"] {
  const t = text.toLowerCase();
  // Terreno: explicit keywords OR land-only features (barda, cisterna, portón, tinaco) without house keywords
  const hasTerrenoKeyword = /(terreno|lote|solar)/.test(t);
  const hasLandOnlyFeatures = /(barda|cerca perimetral|portón|cisterna|tinaco)/.test(t);
  const hasHouseKeyword = /(casa|residencial|vivienda|recámara|habitación|dormitorio|estancia|sala|comedor|cocina)/.test(t);
  const hasDeptoKeyword = /(departamento|depa|condominio)/.test(t);
  const hasLocalKeyword = /(local|comercial|plaza|oficina)(?<!oficina de ventas)/.test(t); // oficina alone can be ambiguous
  const hasBodegaKeyword = /(bodega|almacén|nave industrial)/.test(t);

  if (hasBodegaKeyword) return "bodega";
  if (hasDeptoKeyword) return "departamento";
  if (hasLocalKeyword && !hasTerrenoKeyword) return "local";
  if (hasTerrenoKeyword || (hasLandOnlyFeatures && !hasHouseKeyword)) return "terreno";
  if (hasHouseKeyword) return "casa";
  // Fallback: measurements without house keywords suggest terrain
  if (/mts|m2|m²/.test(t) && !hasHouseKeyword) return "terreno";
  return "casa";
}

/** Determine deal_type and type from rent/sale keywords. */
function inferDealAndType(text: string): Pick<WizardExtractedData, "deal_type" | "type"> {
  const t = text.toLowerCase();
  if (/renta|alquiler|arrenda/.test(t)) {
    return { deal_type: "renta", type: "rent" };
  }
  if (/venta|vendo|en venta|se vende/.test(t)) {
    return { deal_type: "venta_directa", type: "sale" };
  }
  if (/remate/.test(t)) return { deal_type: "remate_bancario", type: "sale" };
  if (/traspaso/.test(t)) return { deal_type: "traspaso", type: "sale" };
  if (/flipping|reparar|flip/.test(t)) return { deal_type: "flipping", type: "sale" };
  return { deal_type: null, type: null };
}

/** Extract price for rent (monthly) or sale. */
function extractPrice(text: string): number | null {
  const t = text.toLowerCase();
  // Look for "renta X pesos" or "precio X" or "$X"
  const rentMatch = t.match(/(?:renta|alquiler)\D*(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)/i);
  const rentValue = rentMatch?.[1];
  if (rentValue) return parseMXN(rentValue);
  const priceMatch = t.match(/(?:precio|costo|valor|venta)\D*(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)/i);
  const priceValue = priceMatch?.[1];
  if (priceValue) return parseMXN(priceValue);
  // Fallback: first large number that looks like price
  const anyNum = t.match(/\$?\s*(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)/);
  const anyValue = anyNum?.[1];
  if (anyValue) {
    const n = parseMXN(anyValue);
    if (n && n >= 1000) return n;
  }
  return null;
}

/** Build enriched description from original text. */
function buildDescription(raw: string, aiDesc: string | null): string {
  if (aiDesc && aiDesc.trim().length > 20) return aiDesc.trim();
  const cleaned = raw.trim().replace(/^inf[:\s]+/i, "").trim();
  return cleaned.slice(0, 4800);
}

/**
 * Create a new draft listing from the wizard's first step.
 * Returns the created listing id so the client can continue editing.
 */
export async function createDraft(
  _prevState: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  const parsed = parseInput(
    propertyWizardStep1Schema,
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const slug = await buildUniqueSlug(parsed.data.title, async (candidate) => {
    const { data } = await supabase
      .from("properties")
      .select("id")
      .eq("slug", candidate)
      .limit(1);
    return (data?.length ?? 0) > 0;
  });

  const { data, error } = await supabase
    .from("properties")
    .insert({
      owner_id: user.id,
      title: parsed.data.title,
      type: parsed.data.type,
      category: parsed.data.category,
      deal_type: parsed.data.deal_type,
      description: parsed.data.description ?? null,
      slug,
      status: "draft",
      current_wizard_step: 1,
    })
    .select("id")
    .single();

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/my-listings");
  return ok({ id: data.id });
}

/**
 * Extract structured property data from free text.
 * Combines AI extraction with deterministic fallback parsing for robustness.
 */
export async function extractWizardText(
  text: string,
): Promise<ActionResult<WizardExtractedData>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();

  const raw = text.trim();
  if (raw.length < 20) {
    return fail("Escribe al menos una descripción corta para extraer datos.");
  }

  // Deterministic fallback extraction (always runs)
  const fallback: Partial<WizardExtractedData> = {
    title: inferTitle(raw),
    price: extractPrice(raw),
    terreno_m2: parseTerrenoM2(raw),
    construccion_m2: parseConstruccionM2(raw),
    contact_phone: extractPhone(raw),
    contact_whatsapp: extractPhone(raw),
    description: buildDescription(raw, null),
    ...inferDealAndType(raw),
    category: inferCategory(raw),
  };

  // Try AI extraction if provider is available
  let aiData: Partial<WizardExtractedData> = {};

  const result = await chatCompletion({
    jsonMode: true,
    temperature: 0,
    maxTokens: 900,
    system: [
      "Eres un extractor de datos para un formulario inmobiliario en México.",
      "Extrae SOLO datos explícitos o fuertemente inferibles del texto del usuario.",
      "No inventes dirección, coordenadas, precio, ciudad ni contacto.",
      "Si un dato no aparece o es ambiguo, usa null.",
      "Normaliza precio a número en MXN: '4.5 millones' => 4500000, '850 mil' => 850000.",
      "Diferencia áreas: terreno_m2 es el tamaño total del terreno/lote; construccion_m2 es únicamente construcción/oficina/local/casa/bodega. Ejemplo: 'Terreno 2500 mts, Oficina 36 mts' => terreno_m2=2500 y construccion_m2=36.",
      "No uses distancias de ubicación ('a 100 mts de...') ni alturas/anchos ('barda 3 mts', 'portón 6 mts') como metros de construcción.",
      "type debe ser 'sale' si se vende y 'rent' si se renta.",
      "category: casa | departamento | local | bodega | terreno.",
      "IMPORTANTE: Si el texto menciona 'terreno', 'lote', 'solar', 'barda', 'cerca perimetral', 'portón', 'cisterna', 'tinaco', o solo medidas de terreno (mts, m2, m²) SIN mencionar construcción/vivienda, la categoría ES 'terreno'.",
      "No clasifiques como 'casa' un terreno con barda, cisterna, portón u oficina para trabajadores.",
      "deal_type: venta_directa | remate_bancario | flipping | traspaso | renta.",
      "Responde solo JSON válido con estas llaves:",
      JSON.stringify({
        title: null,
        type: null,
        category: null,
        deal_type: null,
        description: null,
        price: null,
        terreno_m2: null,
        construccion_m2: null,
        address: null,
        colonia: null,
        city: null,
        state: null,
        zip_code: null,
        contact_phone: null,
        contact_whatsapp: null,
        contact_email: null,
      }),
    ].join("\n"),
    user: raw,
  });

  if (result?.content) {
    try {
      const parsed = JSON.parse(stripJsonFences(result.content)) as unknown;
      const validated = wizardExtractionSchema.safeParse(parsed);
      if (validated.success) {
        aiData = validated.data;
      }
    } catch {
      // Ignore AI parse errors; fallback will be used
    }
  }

  // Merge: AI data takes precedence when present and non-null
  const merged: WizardExtractedData = {
    title: aiData.title ?? fallback.title ?? null,
    type: aiData.type ?? fallback.type ?? null,
    category: aiData.category ?? fallback.category ?? null,
    deal_type: aiData.deal_type ?? fallback.deal_type ?? null,
    description: aiData.description ?? fallback.description ?? null,
    price: aiData.price ?? fallback.price ?? null,
    terreno_m2: aiData.terreno_m2 ?? fallback.terreno_m2 ?? null,
    construccion_m2: aiData.construccion_m2 ?? fallback.construccion_m2 ?? null,
    address: aiData.address ?? fallback.address ?? null,
    colonia: aiData.colonia ?? fallback.colonia ?? null,
    city: aiData.city ?? fallback.city ?? null,
    state: aiData.state ?? fallback.state ?? null,
    zip_code: aiData.zip_code ?? fallback.zip_code ?? null,
    contact_phone: aiData.contact_phone ?? fallback.contact_phone ?? null,
    contact_whatsapp: aiData.contact_whatsapp ?? fallback.contact_whatsapp ?? null,
    contact_email: aiData.contact_email ?? fallback.contact_email ?? null,
  };

  // Post-merge correction: if fallback strongly indicates terreno, override AI
  const t = raw.toLowerCase();
  const hasExplicitTerreno = /(terreno|lote|solar)/.test(t);
  const hasLandOnlyFeatures = /(barda|cerca perimetral|portón|cisterna|tinaco)/.test(t);
  const hasHouseKeyword = /(casa|residencial|vivienda|recámara|habitación|dormitorio|estancia|sala|comedor|cocina)/.test(t);
  const isTerreno = hasExplicitTerreno || (hasLandOnlyFeatures && !hasHouseKeyword);
  if (isTerreno && merged.category !== "terreno") {
    merged.category = "terreno";
    merged.type = merged.type ?? "sale"; // default to sale for land
  }

  const parsedTerrenoM2 = parseTerrenoM2(raw);
  const parsedConstruccionM2 = parseConstruccionM2(raw);
  if (parsedTerrenoM2 !== null) merged.terreno_m2 = parsedTerrenoM2;
  if (parsedConstruccionM2 !== null) merged.construccion_m2 = parsedConstruccionM2;

  // Post-merge correction for deal_type/type from rent keywords
  const hasRentKeyword = /renta|alquiler|arrenda/.test(t);
  if (hasRentKeyword) {
    merged.deal_type = "renta";
    merged.type = "rent";
  }

  return ok(merged);
}

export async function uploadWizardImages(
  formData: FormData,
): Promise<ActionResult<{ urls: string[] }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();

  const files = formData
    .getAll("images")
    .filter((file): file is File => file instanceof File && file.size > 0);

  if (files.length === 0) return fail("Selecciona al menos una imagen.");
  if (files.length > MAX_WIZARD_IMAGES) {
    return fail(`Puedes subir hasta ${MAX_WIZARD_IMAGES} imágenes por propiedad.`);
  }

  for (const file of files) {
    if (!ALLOWED_WIZARD_IMAGE_TYPES.has(file.type)) {
      return fail("Solo se aceptan imágenes JPG, PNG, WebP o GIF.");
    }
    if (file.size > MAX_WIZARD_IMAGE_SIZE) {
      return fail("Cada imagen debe pesar máximo 10 MB.");
    }
  }

  const supabase = await createSupabaseServerClient();
  const urls: string[] = [];

  for (const file of files) {
    const ext = imageExtForType(file.type);
    const path = `wizard/${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) return fail(error.message);

    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    if (data.publicUrl) urls.push(data.publicUrl);
  }

  return ok({ urls });
}

export async function saveWizardStep(
  listingId: string,
  step: WizardStep,
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();

  const schemaMap: Record<WizardStep, z.ZodTypeAny> = {
    1: propertyWizardStep1Schema,
    2: propertyWizardStep2Schema,
    3: propertyWizardStep3Schema,
    4: propertyWizardStep4Schema,
    5: propertyWizardStep5Schema,
  };

  const parsed = parseInput(schemaMap[step], input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  // Ownership check — defense in depth beyond RLS.
  const { data: existing } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", listingId)
    .limit(1);
  if (existing?.[0]?.owner_id !== user.id) {
    return fail("No eres dueño de este listado.");
  }

  const nextStep = (Math.min(step + 1, 5) as WizardStep);
  const { error } = await supabase
    .from("properties")
    .update({
      ...(parsed.data as Record<string, unknown>),
      current_wizard_step: nextStep,
    })
    .eq("id", listingId);

  if (error) {
    return fail(error.message);
  }

  return ok({ id: listingId });
}

/**
 * Publish (or archive) a listing once the wizard is complete.
 * Validation ensures all steps are filled before activation.
 */
export async function setListingStatus(
  listingId: string,
  status: "active" | "archived",
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("properties")
    .select("*")
    .eq("id", listingId)
    .returns<PropertiesRow[]>()
    .limit(1);

  const listing = existing?.[0];
  if (!listing) {
    return fail("Listado no encontrado.");
  }
  if (listing.owner_id !== user.id) {
    return fail("No eres dueño de este listado.");
  }

  if (status === "active") {
    // Enforce wizard completeness: all four steps have valid data.
    const full = parseInput(propertyCreateSchema, {
      title: listing.title,
      type: listing.type,
      description: listing.description ?? undefined,
      price: listing.price,
      currency: listing.currency,
      terreno_m2: listing.terreno_m2,
      construccion_m2: listing.construccion_m2,
      address: listing.address,
      colonia: listing.colonia,
      city: listing.city,
      state: listing.state,
      zip_code: listing.zip_code ?? undefined,
      lat: listing.lat,
      lng: listing.lng,
      images: listing.images ?? [],
      tour_360_url: listing.tour_360_url ?? undefined,
      video_url: listing.video_url ?? undefined,
    });

    if (!full.success) {
      return fail("Complete all wizard steps before publishing.");
    }
  }

  const { error } = await supabase
    .from("properties")
    .update({ status })
    .eq("id", listingId);

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/my-listings");
  return ok({ id: listingId });
}

/**
 * Change the category of an existing listing (e.g. from "Mis listados").
 * Only the property owner can mutate (enforced server-side + RLS).
 */
export async function updateListingCategory(
  listingId: string,
  category: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();

  const parsed = propertyCategorySchema.safeParse(category);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Categoría no válida.");
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", listingId)
    .limit(1);
  if (existing?.[0]?.owner_id !== user.id) {
    return fail("No eres dueño de este listado.");
  }

  const { error } = await supabase
    .from("properties")
    .update({ category: parsed.data })
    .eq("id", listingId);

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/my-listings");
  revalidatePath("/property/[slug]");
  return ok({ id: listingId });
}

/**
 * Update the contact data (agent WhatsApp, phone, email…) of an existing
 * listing. Only the property owner can mutate (enforced server-side + RLS).
 */
export async function updateListingContact(
  listingId: string,
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();

  const parsed = parseInput(propertyWizardStep5Schema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", listingId)
    .limit(1);
  if (existing?.[0]?.owner_id !== user.id) {
    return fail("No eres dueño de este listado.");
  }

  const { error } = await supabase
    .from("properties")
    .update(parsed.data as Partial<PropertiesRow>)
    .eq("id", listingId);

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/my-listings");
  revalidatePath("/property/[slug]");
  return ok({ id: listingId });
}

/**
 * Hard-delete a draft (soft-archive is preferred for live listings).
 */
export async function deleteListing(listingId: string): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("properties")
    .select("owner_id, status")
    .eq("id", listingId)
    .limit(1);

  if (existing?.[0]?.owner_id !== user.id) {
    return fail("No eres dueño de este listado.");
  }

  const { error } = await supabase.from("properties").delete().eq("id", listingId);
  if (error) {
    return fail(error.message);
  }

  revalidatePath("/my-listings");
  return ok(undefined);
}

/**
 * Persist a property imported via the Universal Importer as a draft listing.
 */
export async function createImportedDraft(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  const parsed = parseInput(importedPropertyDraftSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const slug = await buildUniqueSlug(parsed.data.title, async (candidate) => {
    const { data } = await supabase
      .from("properties")
      .select("id")
      .eq("slug", candidate)
      .limit(1);
    return (data?.length ?? 0) > 0;
  });

  // Normalize USD-priced listings to MXN (× 17.5) so the catalog is single-currency.
  const price =
    parsed.data.currency === "USD"
      ? Math.round(parsed.data.price * USD_TO_MXN_RATE)
      : parsed.data.price;
  const currency = "MXN";

  const { data, error } = await supabase
    .from("properties")
    .insert({
      owner_id: user.id,
      title: parsed.data.title,
      type: "sale",
      description: parsed.data.description || null,
      slug,
      status: "draft",
      current_wizard_step: 4,
      category: parsed.data.category,
      deal_type: parsed.data.deal_type,
      costo_reparacion_estimado: parsed.data.costo_reparacion_estimado,
      valor_post_reparacion_estimado: parsed.data.valor_post_reparacion_estimado,
      institucion_bancaria: parsed.data.institucion_bancaria,
      fecha_remate: parsed.data.fecha_remate,
      condiciones_traspaso: parsed.data.condiciones_traspaso,
      price,
      currency,
      terreno_m2: parsed.data.terreno_m2,
      construccion_m2: parsed.data.construccion_m2,
      recamaras: parsed.data.recamaras,
      banos: parsed.data.banos,
      estacionamientos: parsed.data.estacionamientos,
      antiguedad: parsed.data.antiguedad,
      address: parsed.data.address,
      colonia: parsed.data.colonia,
      city: parsed.data.city,
      state: parsed.data.state,
      zip_code: parsed.data.zip_code,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      images: parsed.data.images,
      source_url: parsed.data.source_url,
      puntos_fuertes_bento: parsed.data.bento_highlights,
    })
    .select("id, slug")
    .single();

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/my-listings");
  revalidatePath("/favorites");
  return ok({ id: data.id, slug: data.slug });
}

/**
 * Capture a lead from the mortgage simulator on the property detail page.
 * The id is generated server-side because RLS on mortgage_leads is
 * insert-only (no SELECT policy), so `insert().select()` would fail.
 */
export async function captureMortgageLead(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parseInput(mortgageLeadSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const id = crypto.randomUUID();
  const { error } = await supabase.from("mortgage_leads").insert({
    id,
    property_id: parsed.data.propertyId,
    property_title: parsed.data.propertyTitle,
    property_price: parsed.data.propertyPrice,
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
    email: parsed.data.email,
    simulated_monthly_payment: parsed.data.simulatedMonthlyPayment,
    simulated_down_payment: parsed.data.simulatedDownPayment,
    simulation: parsed.data.simulation ?? {},
  });

  if (error) {
    return fail(error.message);
  }

  return ok({ id });
}
