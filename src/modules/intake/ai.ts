import "server-only";

import { chatCompletion } from "@/modules/ai/server";
import { AIExtractionSchema, type AIExtraction } from "@/modules/intake/schemas";

/**
 * DeepSeek-powered extraction for the "Sube tu propiedad" WhatsApp intake.
 *
 * The seller writes free text ("Vendo mi casa en San Felipe, 3 cuartos,
 * alberca, pido 4.5 millones") and the model returns a strictly-typed JSON.
 * Anything the text doesn't mention stays null — never guessed — so the web
 * wizard knows exactly which slides to ask.
 */

const SYSTEM_PROMPT = [
  "Eres un extractor de datos inmobiliarios para un portal en Chihuahua, México.",
  "Del mensaje del vendedor extrae SOLO lo explícitamente mencionado.",
  "Reglas estrictas:",
  "- Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni explicación.",
  "- Si un dato no se menciona o es ambiguo, usa null. NUNCA inventes valores.",
  "- precio: número en MXN sin símbolos (interpreta '4.5 millones' como 4500000, '600 mil' como 600000).",
  "- tipo_operacion: 'sale' si vende, 'rent' si renta.",
  "- tipo_propiedad: casa | departamento | local | bodega | terreno.",
  "- banos admite medios (1.5, 2.5). recamaras y estacionamientos son enteros.",
  "- amenidades: lista de strings en minúsculas (ej. [\"alberca\", \"jardín\", \"cuarto de servicio\"]).",
  "- descripcion: resume el mensaje en máximo 2 oraciones, en español neutro.",
  "Esquema JSON exacto:",
  '{"tipo_operacion":...,"tipo_propiedad":...,"precio":...,"colonia":...,"ciudad":...,',
  '"recamaras":...,"banos":...,"construccion_m2":...,"terreno_m2":...,',
  '"estacionamientos":...,"antiguedad":...,"amenidades":[...],"descripcion":...}',
].join("\n");

function stripJsonFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return ((fenced && fenced[1]) ?? text).trim();
}

/**
 * Extract a validated AIExtraction from free seller text.
 * Returns null when the AI provider is unavailable or the payload fails
 * validation — callers treat that as "all fields missing".
 */
export async function extractPropertyFromText(
  rawText: string,
): Promise<AIExtraction | null> {
  const text = rawText.trim();
  if (!text) return null;

  const result = await chatCompletion({
    system: SYSTEM_PROMPT,
    user: text,
    jsonMode: true,
    temperature: 0,
    maxTokens: 600,
  });

  const content = result?.content;
  if (!content) return null;

  try {
    const parsed: unknown = JSON.parse(stripJsonFences(content));
    const validated = AIExtractionSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}
