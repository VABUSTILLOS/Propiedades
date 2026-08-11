import "server-only";

/**
 * Server-side property extraction fallback.
 *
 * The canonical ingestion path is the `import-property-ai` Supabase Edge
 * Function (URL scraping + DeepSeek JSON extraction + Whisper transcription).
 * This module mirrors that logic in-process so the app degrades gracefully
 * when the function is not yet deployed. Both paths return the same strict
 * `AiExtractedProperty` contract (Zod-validated).
 */

import { aiExtractedPropertySchema, type AiExtractedProperty } from "@/modules/lib/schemas";
import { callDeepSeek } from "@/modules/ai/server";

type ExtractionSource = "url" | "text" | "voice";

/** Fetch a public page and build a compact scrapable text digest. */
async function scrapePage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (html.length > 2_000_000) return null;

    const title =
      html.match(
        /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
      )?.[1] ??
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ??
      null;
    const description =
      html.match(
        /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
      )?.[1] ??
      html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
      )?.[1] ??
      null;

    const rawText = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);

    return [title, description, rawText].filter(Boolean).join("\n---\n") || null;
  } catch {
    return null;
  }
}

/** Parse + validate a strict JSON response from DeepSeek. */
function parseExtraction(raw: string): AiExtractedProperty | null {
  try {
    return aiExtractedPropertySchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Extract a structured property from a URL, free text, or voice transcript.
 * Returns `null` when the input can't be parsed or no DeepSeek key is set.
 */
export async function extractProperty(
  source: ExtractionSource,
  content: string,
): Promise<AiExtractedProperty | null> {
  let prompt: string;

  if (source === "url") {
    if (!/^https?:\/\//i.test(content)) return null;
    const page = await scrapePage(content);
    if (!page) return null;
    prompt = `FUENTE: URL publicada en Facebook Marketplace.\nURL: ${content}\n\nCONTENIDO:\n${page}`;
  } else if (source === "voice") {
    // Voice transcription requires the edge function + OPENAI_API_KEY. In-process
    // we still let DeepSeek attempt parsing of whatever text was supplied.
    prompt = `FUENTE: Nota de voz de un vendedor inmobiliario.\n\nTRANSCRIPCION:\n${content}`;
  } else {
    prompt = `FUENTE: Texto libre de un vendedor inmobiliario.\n\nTEXTO:\n${content}`;
  }

  const raw = await callDeepSeek(
    prompt +
      "\n\nExtrae el JSON estricto con las claves: " +
      'titulo (string), precio (number MXN), recamaras (int o null), banos (int o null), ' +
      "amenidades_array (array de strings), puntos_fuertes_bento (array de 1-6 strings cortos), " +
      "colonia (string o null), city (string o null), precio_m2_const (number opcional). " +
      "Responde únicamente JSON válido.",
  );
  if (!raw) return null;
  return parseExtraction(raw);
}
