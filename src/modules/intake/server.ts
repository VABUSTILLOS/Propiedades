import "server-only";

import { extractPropertyFromText } from "@/modules/intake/ai";
import {
  computeMissingFields,
  FIELD_REGISTRY,
  INTAKE_FIELD_KEYS,
  suggestEstimate,
  toFieldDefDTO,
  type AIExtraction,
  type IntakeFieldKey,
  type IntakeStateDTO,
  type PrefilledFieldDTO,
} from "@/modules/intake/schemas";
import { createSupabaseServiceClient } from "@/modules/lib/supabase/service";
import type { PropertiesRow } from "@/modules/lib/database.types";
import { computeHotScore } from "@/modules/market-data/queries";

/**
 * Server-side intake pipeline for "Sube tu propiedad".
 *
 * Owns the full lifecycle of a property born from WhatsApp/web intake:
 * draft creation → AI extraction → wizard state → activation. All DB access
 * uses the service role; the wizard is authorized by the unguessable
 * `intake_token` capability instead of a user session.
 */

const DEFAULT_CITY = "Chihuahua";
const DEFAULT_STATE = "Chihuahua";

export interface IntakeDraft {
  id: string;
  token: string;
}

export type IntakeStateResult =
  | { ok: true; state: IntakeStateDTO }
  | { ok: false; error: "not_found" | "expired" };

export type ActivateResult =
  | {
      ok: true;
      slug: string;
      opportunityScore: number | null;
      discountPct: number | null;
      benchmarkM2: number | null;
    }
  | { ok: false; error: "not_found" | "expired" | "incomplete" | "not_intake" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildTitle(extraction: Partial<AIExtraction> | null): string {
  const category = extraction?.tipo_propiedad ?? null;
  const colonia = extraction?.colonia ?? null;
  const label =
    category === "casa"
      ? "Casa"
      : category === "departamento"
        ? "Departamento"
        : category === "local"
          ? "Local"
          : category === "bodega"
            ? "Bodega"
            : category === "terreno"
              ? "Terreno"
              : "Propiedad";
  return colonia ? `${label} en ${colonia}` : `${label} por publicar`;
}

function rowValueFor(row: PropertiesRow, key: IntakeFieldKey): number | string | null {
  const column = FIELD_REGISTRY[key].column;
  const value = row[column];
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return key === "recamaras" && value === 0 ? null : value;
  if (typeof value === "string") return value.trim() ? value : null;
  return null;
}

function extractionFromRow(row: PropertiesRow): AIExtraction {
  return {
    tipo_operacion: row.type ?? null,
    tipo_propiedad: row.category ?? null,
    precio: row.price > 0 ? row.price : null,
    colonia: row.colonia?.trim() ? row.colonia : null,
    ciudad: row.city?.trim() ? row.city : null,
    recamaras: row.recamaras && row.recamaras > 0 ? row.recamaras : null,
    banos: row.banos && row.banos > 0 ? row.banos : null,
    construccion_m2: row.construccion_m2 > 0 ? row.construccion_m2 : null,
    terreno_m2: row.terreno_m2 > 0 ? row.terreno_m2 : null,
    estacionamientos: row.estacionamientos,
    antiguedad: row.antiguedad,
    amenidades: Array.isArray(row.amenidades)
      ? (row.amenidades as unknown[]).filter((a): a is string => typeof a === "string")
      : [],
    descripcion: row.description,
  };
}

function toStateDTO(row: PropertiesRow): IntakeStateDTO {
  const extraction = extractionFromRow(row);
  const missingKeys = computeMissingFields(extraction);

  const prefilled: PrefilledFieldDTO[] = INTAKE_FIELD_KEYS.flatMap((key) => {
    if (missingKeys.includes(key)) return [];
    const value = rowValueFor(row, key);
    if (value === null) return [];
    return [{ key, value, label: FIELD_REGISTRY[key].formatValue(value) }];
  });

  return {
    id: row.id,
    slug: row.slug,
    status: (row.intake_status ?? "borrador_incompleto") as IntakeStateDTO["status"],
    images: row.images ?? [],
    colonia: extraction.colonia,
    prefilled,
    missing: missingKeys.map((key) =>
      toFieldDefDTO(FIELD_REGISTRY[key], suggestEstimate(key, extraction)),
    ),
    expiresAt: row.intake_expires_at ?? "",
  };
}

async function fetchByToken(token: string): Promise<PropertiesRow | null> {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("properties")
    .select("*")
    .eq("intake_token", token)
    .maybeSingle();
  return data;
}

function isExpired(row: PropertiesRow): boolean {
  return Boolean(row.intake_expires_at && new Date(row.intake_expires_at) < new Date());
}

// ── Draft creation (Canal 1: WhatsApp) ────────────────────────────────────────

/**
 * Find an open intake draft for this WhatsApp sender (last 24h) so a burst of
 * photos/text appends to one property instead of creating duplicates.
 */
export async function findOpenIntake(waId: string): Promise<IntakeDraft | null> {
  const supabase = createSupabaseServiceClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("properties")
    .select("id, intake_token")
    .eq("wa_id", waId)
    .in("intake_status", ["procesando", "borrador_incompleto"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.intake_token) return null;
  return { id: data.id, token: data.intake_token };
}

/** Create the draft property in 'procesando' state with raw text + photos. */
export async function createIntakeDraft(input: {
  waId: string;
  profileName?: string | null;
  text: string;
  imageUrls: string[];
  channel?: "whatsapp" | "web";
}): Promise<IntakeDraft | null> {
  const supabase = createSupabaseServiceClient();
  const title = "Propiedad por publicar";
  const slug = `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`;

  const { data, error } = await supabase
    .from("properties")
    .insert({
      title,
      slug,
      status: "draft",
      type: "sale",
      category: "casa",
      intake_status: "procesando",
      intake_channel: input.channel ?? "whatsapp",
      wa_id: input.waId,
      wa_profile_name: input.profileName ?? null,
      ai_raw_text: input.text,
      images: input.imageUrls,
      city: DEFAULT_CITY,
      state: DEFAULT_STATE,
    })
    .select("id, intake_token")
    .single();

  if (error || !data?.intake_token) return null;
  return { id: data.id, token: data.intake_token };
}

/** Append extra photos/text to an existing open draft. */
export async function appendToIntakeDraft(
  propertyId: string,
  input: { text?: string; imageUrls?: string[] },
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { data: row } = await supabase
    .from("properties")
    .select("images, ai_raw_text")
    .eq("id", propertyId)
    .single();
  if (!row) return;

  await supabase
    .from("properties")
    .update({
      images: [...(row.images ?? []), ...(input.imageUrls ?? [])],
      ai_raw_text: input.text
        ? [row.ai_raw_text, input.text].filter(Boolean).join("\n")
        : row.ai_raw_text,
    })
    .eq("id", propertyId);
}

// ── AI extraction (background task) ───────────────────────────────────────────

/**
 * Run DeepSeek extraction over the draft's raw text, persist the validated
 * result, compute missing_fields and flip the row to 'borrador_incompleto'.
 * Returns the extraction (null when the provider failed — then every
 * required field becomes a slide).
 */
export async function runExtraction(propertyId: string): Promise<AIExtraction | null> {
  const supabase = createSupabaseServiceClient();
  const { data: row } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();
  if (!row) return null;

  const extraction = await extractPropertyFromText(row.ai_raw_text ?? "");

  const update: Partial<PropertiesRow> = {
    ai_extracted: extraction ?? {},
    intake_status: "borrador_incompleto",
  };

  if (extraction) {
    if (extraction.tipo_operacion) update.type = extraction.tipo_operacion;
    if (extraction.tipo_propiedad) update.category = extraction.tipo_propiedad;
    if (extraction.precio) update.price = extraction.precio;
    if (extraction.colonia) update.colonia = extraction.colonia;
    if (extraction.ciudad) update.city = extraction.ciudad;
    if (extraction.recamaras !== null) update.recamaras = extraction.recamaras;
    if (extraction.banos !== null) update.banos = extraction.banos;
    if (extraction.construccion_m2)
      update.construccion_m2 = extraction.construccion_m2;
    if (extraction.terreno_m2) update.terreno_m2 = extraction.terreno_m2;
    if (extraction.estacionamientos !== null)
      update.estacionamientos = extraction.estacionamientos;
    if (extraction.antiguedad !== null) update.antiguedad = extraction.antiguedad;
    if (extraction.amenidades.length > 0) update.amenidades = extraction.amenidades;
    if (extraction.descripcion) update.description = extraction.descripcion;

    const title = buildTitle(extraction);
    update.title = title;
    update.slug = `${slugify(title)}-${row.id.slice(0, 8)}`;
    update.missing_fields = computeMissingFields(extraction);
  } else {
    // Extraction failed: every required field becomes a wizard slide.
    update.missing_fields = computeMissingFields({
      tipo_operacion: null,
      tipo_propiedad: null,
      precio: null,
      colonia: null,
      recamaras: null,
      banos: null,
      construccion_m2: null,
      terreno_m2: null,
    });
  }

  await supabase.from("properties").update(update).eq("id", propertyId);
  return extraction;
}

// ── Wizard state (Canal 2) ────────────────────────────────────────────────────

/** Sanitized state for the wizard — never exposes wa_id or service data. */
export async function getIntakeState(token: string): Promise<IntakeStateResult> {
  const row = await fetchByToken(token);
  if (!row || !row.intake_status) return { ok: false, error: "not_found" };
  if (isExpired(row)) return { ok: false, error: "expired" };
  return { ok: true, state: toStateDTO(row) };
}

/**
 * Validate + persist one wizard answer, recompute missing fields and return
 * the refreshed state so the client can advance optimistically.
 */
export async function applyAnswer(
  token: string,
  field: IntakeFieldKey,
  value: number | string,
): Promise<IntakeStateResult> {
  const def = FIELD_REGISTRY[field];
  const parsed = def.answerSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: "not_found" };

  const row = await fetchByToken(token);
  if (!row || !row.intake_status) return { ok: false, error: "not_found" };
  if (isExpired(row)) return { ok: false, error: "expired" };

  const supabase = createSupabaseServiceClient();
  const update = { [def.column]: parsed.data } as Partial<PropertiesRow>;
  if (field === "tipo_propiedad") {
    // Category affects the title and whether terreno_m2 is required.
    const extraction = extractionFromRow({ ...row, category: parsed.data } as PropertiesRow);
    update.title = buildTitle(extraction);
    update.slug = `${slugify(String(update.title))}-${row.id.slice(0, 8)}`;
  }

  await supabase.from("properties").update(update).eq("id", row.id);

  const refreshed = await fetchByToken(token);
  if (!refreshed) return { ok: false, error: "not_found" };

  const missing = computeMissingFields(extractionFromRow(refreshed));
  await supabase
    .from("properties")
    .update({ missing_fields: missing })
    .eq("id", row.id);

  return { ok: true, state: toStateDTO({ ...refreshed, missing_fields: missing }) };
}

// ── Activation ────────────────────────────────────────────────────────────────

/**
 * Final slide: validate completeness, compute the opportunity score against
 * the colonia benchmark and publish the property to the feed.
 */
export async function activateIntake(token: string): Promise<ActivateResult> {
  const row = await fetchByToken(token);
  if (!row || !row.intake_status) return { ok: false, error: "not_found" };
  if (row.intake_status === "activo" && row.status === "active") {
    return { ok: false, error: "not_intake" };
  }
  if (isExpired(row)) return { ok: false, error: "expired" };

  const extraction = extractionFromRow(row);
  const missing = computeMissingFields(extraction);
  if (missing.length > 0) return { ok: false, error: "incomplete" };

  // Benchmark vs colonia (public table, service read works everywhere).
  const supabase = createSupabaseServiceClient();
  const { data: benchmark } = await supabase
    .from("market_benchmarks")
    .select("avg_price_m2_const")
    .eq("city", row.city || DEFAULT_CITY)
    .eq("colonia", row.colonia)
    .limit(1)
    .maybeSingle();

  const benchmarkM2 = benchmark?.avg_price_m2_const ?? null;
  const priceM2 =
    row.construccion_m2 > 0 ? row.price / row.construccion_m2 : null;
  const discountPct =
    benchmarkM2 && priceM2
      ? Math.round(((benchmarkM2 - priceM2) / benchmarkM2) * 10_000) / 100
      : null;
  const opportunityScore = computeHotScore({ discountPct, m2: priceM2 });

  const aiExtracted = {
    ...(typeof row.ai_extracted === "object" && row.ai_extracted !== null
      ? (row.ai_extracted as Record<string, unknown>)
      : {}),
    opportunity_score: opportunityScore,
    discount_pct_vs_colonia: discountPct,
    benchmark_m2_colonia: benchmarkM2,
  };

  await supabase
    .from("properties")
    .update({
      status: "active",
      intake_status: "activo",
      missing_fields: [],
      ai_extracted: aiExtracted,
      property_score: opportunityScore,
    })
    .eq("id", row.id);

  return {
    ok: true,
    slug: row.slug,
    opportunityScore,
    discountPct,
    benchmarkM2,
  };
}
