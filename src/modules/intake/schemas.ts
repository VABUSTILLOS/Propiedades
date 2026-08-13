import { z } from "zod";

/**
 * Intake schemas — single source of truth for the "Sube tu propiedad" flow.
 *
 * Both the backend (extraction, answer validation, activation) and the web
 * wizard (dynamic slide generation) import from this module, so a field can
 * never drift between what the AI extracted, what the DB stores, and what
 * the UI asks.
 */

// ── AI extraction ────────────────────────────────────────────────────────────

/**
 * What DeepSeek must return from the seller's free text. Everything is
 * nullable on purpose: the model never invents data — what it cannot tell
 * from the message stays null and becomes a wizard slide.
 */
export const AIExtractionSchema = z.object({
  tipo_operacion: z.enum(["sale", "rent"]).nullable(),
  tipo_propiedad: z
    .enum(["casa", "departamento", "local", "bodega", "terreno"])
    .nullable(),
  precio: z.number().positive().nullable(),
  colonia: z.string().trim().min(1).nullable(),
  ciudad: z.string().trim().min(1).nullable(),
  recamaras: z.number().int().min(0).max(20).nullable(),
  /** Full bathrooms; halves allowed (1.5, 2.5…). */
  banos: z.number().min(0).max(20).nullable(),
  construccion_m2: z.number().positive().max(100_000).nullable(),
  terreno_m2: z.number().positive().max(1_000_000).nullable(),
  estacionamientos: z.number().int().min(0).max(10).nullable(),
  antiguedad: z.number().int().min(0).max(200).nullable(),
  amenidades: z.array(z.string().trim().min(1)).max(30).default([]),
  descripcion: z.string().trim().max(2_000).nullable(),
});

export type AIExtraction = z.infer<typeof AIExtractionSchema>;

// ── Intake field keys ─────────────────────────────────────────────────────────

export const INTAKE_FIELD_KEYS = [
  "tipo_operacion",
  "tipo_propiedad",
  "precio",
  "colonia",
  "recamaras",
  "banos",
  "construccion_m2",
  "terreno_m2",
  "estacionamientos",
] as const;

export type IntakeFieldKey = (typeof INTAKE_FIELD_KEYS)[number];

// ── Field registry (drives the dynamic slides) ───────────────────────────────

export type SlideInputType = "number" | "quick-select" | "text";

export interface QuickOption {
  value: number | string;
  label: string;
}

export interface FieldDef {
  key: IntakeFieldKey;
  /** Column on `properties` this answer writes to. */
  column:
    | "type"
    | "category"
    | "price"
    | "colonia"
    | "recamaras"
    | "banos"
    | "construccion_m2"
    | "terreno_m2"
    | "estacionamientos";
  /** The giant question shown on the slide. */
  question: string;
  /** Short follow-up line under the question. */
  helper?: string;
  input: SlideInputType;
  unit?: string;
  placeholder?: string;
  options?: QuickOption[];
  /** Per-answer validation; also used by PATCH /api/intake/[token]. */
  answerSchema: z.ZodType<number | string>;
  /** Human label for a filled value, used in the "detected" summary. */
  formatValue: (value: number | string) => string;
}

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export const OPERACION_OPTIONS: QuickOption[] = [
  { value: "sale", label: "Vender" },
  { value: "rent", label: "Rentar" },
];

export const PROPIEDAD_OPTIONS: QuickOption[] = [
  { value: "casa", label: "Casa" },
  { value: "departamento", label: "Departamento" },
  { value: "local", label: "Local" },
  { value: "bodega", label: "Bodega" },
  { value: "terreno", label: "Terreno" },
];

export const FIELD_REGISTRY: Record<IntakeFieldKey, FieldDef> = {
  tipo_operacion: {
    key: "tipo_operacion",
    column: "type",
    question: "¿Qué quieres hacer con tu propiedad?",
    input: "quick-select",
    options: OPERACION_OPTIONS,
    answerSchema: z.enum(["sale", "rent"]),
    formatValue: (v) =>
      OPERACION_OPTIONS.find((o) => o.value === v)?.label ?? String(v),
  },
  tipo_propiedad: {
    key: "tipo_propiedad",
    column: "category",
    question: "¿Qué tipo de propiedad es?",
    input: "quick-select",
    options: PROPIEDAD_OPTIONS,
    answerSchema: z.enum(["casa", "departamento", "local", "bodega", "terreno"]),
    formatValue: (v) =>
      PROPIEDAD_OPTIONS.find((o) => o.value === v)?.label ?? String(v),
  },
  precio: {
    key: "precio",
    column: "price",
    question: "¿En cuánto la quieres publicar?",
    helper: "El precio es visible en el portal y alimenta tu Score de Oportunidad.",
    input: "number",
    unit: "MXN",
    placeholder: "4,500,000",
    answerSchema: z.number().positive().max(1_000_000_000),
    formatValue: (v) => mxn.format(Number(v)),
  },
  colonia: {
    key: "colonia",
    column: "colonia",
    question: "¿En qué colonia está?",
    helper: "La usamos para calcular el benchmark de tu zona.",
    input: "text",
    placeholder: "Ej. San Felipe",
    answerSchema: z.string().trim().min(2).max(120),
    formatValue: (v) => String(v),
  },
  recamaras: {
    key: "recamaras",
    column: "recamaras",
    question: "¿Cuántas recámaras tiene?",
    input: "quick-select",
    options: [
      { value: 1, label: "1" },
      { value: 2, label: "2" },
      { value: 3, label: "3" },
      { value: 4, label: "4" },
      { value: 5, label: "5+" },
    ],
    answerSchema: z.number().int().min(0).max(20),
    formatValue: (v) => `${v} rec.`,
  },
  banos: {
    key: "banos",
    column: "banos",
    question: "¿Cuántos baños completos tiene?",
    input: "quick-select",
    options: [
      { value: 1, label: "1" },
      { value: 1.5, label: "1.5" },
      { value: 2, label: "2" },
      { value: 2.5, label: "2.5" },
      { value: 3, label: "3+" },
    ],
    answerSchema: z.number().min(0).max(20),
    formatValue: (v) => `${v} baños`,
  },
  construccion_m2: {
    key: "construccion_m2",
    column: "construccion_m2",
    question: "Confirmemos los metros de construcción…",
    helper: "Si no los sabes exactos, un estimado funciona para activarla.",
    input: "number",
    unit: "m²",
    placeholder: "180",
    answerSchema: z.number().positive().max(100_000),
    formatValue: (v) => `${v} m² const.`,
  },
  terreno_m2: {
    key: "terreno_m2",
    column: "terreno_m2",
    question: "¿Y de terreno?",
    input: "number",
    unit: "m²",
    placeholder: "250",
    answerSchema: z.number().positive().max(1_000_000),
    formatValue: (v) => `${v} m² terr.`,
  },
  estacionamientos: {
    key: "estacionamientos",
    column: "estacionamientos",
    question: "¿Cuántos cajones de estacionamiento?",
    input: "quick-select",
    options: [
      { value: 0, label: "0" },
      { value: 1, label: "1" },
      { value: 2, label: "2" },
      { value: 3, label: "3+" },
    ],
    answerSchema: z.number().int().min(0).max(10),
    formatValue: (v) => `${v} cajones`,
  },
};

// ── Missing-fields computation ────────────────────────────────────────────────

/** Fields that must be answered before a property can go live. */
const REQUIRED_FIELDS = [
  "tipo_operacion",
  "tipo_propiedad",
  "precio",
  "colonia",
  "recamaras",
  "banos",
  "construccion_m2",
] as const;

function isAnswered(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return value > 0;
  return true;
}

/**
 * Fields the wizard still must ask, in slide order. `terreno_m2` is only
 * required for casa/terreno (departamentos raramente lo reportan) and
 * `estacionamientos` is always optional.
 */
export function computeMissingFields(
  extraction: Pick<
    AIExtraction,
    | "tipo_operacion"
    | "tipo_propiedad"
    | "precio"
    | "colonia"
    | "recamaras"
    | "banos"
    | "construccion_m2"
    | "terreno_m2"
  >,
): IntakeFieldKey[] {
  const missing: IntakeFieldKey[] = REQUIRED_FIELDS.filter(
    (key) => !isAnswered(extraction[key]),
  );

  const needsTerreno =
    extraction.tipo_propiedad === "casa" ||
    extraction.tipo_propiedad === "terreno" ||
    extraction.tipo_propiedad === null;
  if (needsTerreno && !isAnswered(extraction.terreno_m2)) {
    missing.push("terreno_m2");
  }

  return missing;
}

// ── Wizard-facing DTO ─────────────────────────────────────────────────────────

/** Serializable slice of a FieldDef safe to send to the client. */
export interface FieldDefDTO {
  key: IntakeFieldKey;
  question: string;
  helper?: string;
  input: SlideInputType;
  unit?: string;
  placeholder?: string;
  options?: QuickOption[];
  /** AI/heuristic estimate shown as a tappable chip ("¿Son ~180 m²?"). */
  suggestion?: number | string;
}

export function toFieldDefDTO(
  def: FieldDef,
  suggestion?: number | string,
): FieldDefDTO {
  return {
    key: def.key,
    question: def.question,
    helper: def.helper,
    input: def.input,
    unit: def.unit,
    placeholder: def.placeholder,
    options: def.options,
    suggestion,
  };
}

/**
 * Zone-based estimates offered as one-tap chips. Pure heuristics — the value
 * is only stored if the user explicitly taps the suggestion.
 */
export function suggestEstimate(
  key: IntakeFieldKey,
  extraction: Pick<
    AIExtraction,
    "recamaras" | "terreno_m2" | "construccion_m2"
  >,
): number | undefined {
  const round10 = (n: number) => Math.round(n / 10) * 10;
  switch (key) {
    case "construccion_m2":
      // Typical build/land ratio in Chihuahua colonias (~60%).
      return extraction.terreno_m2 ? round10(extraction.terreno_m2 * 0.6) : undefined;
    case "terreno_m2":
      return extraction.construccion_m2
        ? round10(extraction.construccion_m2 * 1.6)
        : undefined;
    case "banos":
      return extraction.recamaras
        ? Math.max(1, extraction.recamaras - 1)
        : undefined;
    case "estacionamientos":
      return extraction.recamaras
        ? Math.min(2, Math.max(1, extraction.recamaras - 1))
        : undefined;
    default:
      return undefined;
  }
}

export interface PrefilledFieldDTO {
  key: IntakeFieldKey;
  value: number | string;
  label: string;
}

export interface IntakeStateDTO {
  id: string;
  slug: string;
  status: "procesando" | "borrador_incompleto" | "activo";
  images: string[];
  colonia: string | null;
  /** Fields the AI already answered — shown as summary, never re-asked. */
  prefilled: PrefilledFieldDTO[];
  /** Slides to render, in order. */
  missing: FieldDefDTO[];
  expiresAt: string;
}

export const answerRequestSchema = z.object({
  field: z.enum(INTAKE_FIELD_KEYS),
  value: z.union([z.number(), z.string()]),
});

export type AnswerRequest = z.infer<typeof answerRequestSchema>;
