// =============================================================================
// import-property-ai — multimodal property ingestion (Stage 2)
//
// Receives a Facebook Marketplace URL, unstructured text, or a voice note,
// extracts structured data, and returns strict JSON (Zod-validated):
//   { titulo, precio, recamaras, banos, amenidades_array,
//     puntos_fuertes_bento, colonia?, city?, precio_m2_const? }
//
// The caller (a Next.js Server Action) persists the property + auto-flyer.
// Extraction pipeline:
//   url   -> fetch HTML, parse og:meta tags + visible text
//   text  -> raw content
//   voice -> Whisper transcription (requires OPENAI_API_KEY) then AI parse
// Then DeepSeek (deepseek-chat) extracts the strict JSON contract.
//
// Deploy: supabase functions deploy import-property-ai
// =============================================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const aiExtractedPropertySchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  precio: z.number().min(0).max(999_999_999_999),
  recamaras: z.number().int().min(0).max(50).nullable().default(null),
  banos: z.number().int().min(0).max(50).nullable().default(null),
  amenidades_array: z
    .array(z.string().trim().min(1).max(100))
    .max(50)
    .default([]),
  puntos_fuertes_bento: z
    .array(z.string().trim().min(1).max(140))
    .max(6)
    .default([]),
  colonia: z.string().trim().max(100).nullable().default(null),
  city: z.string().trim().max(100).nullable().default(null),
  precio_m2_const: z.number().min(0).optional(),
});

type AiExtractedProperty = z.infer<typeof aiExtractedPropertySchema>;

const REQUEST_SCHEMA = z.object({
  source: z.enum(["url", "text", "voice"]),
  content: z.string().trim().min(3).max(50_000),
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Fetch a public page and extract a compact, scrapable text digest. */
async function extractTextFromUrl(url: string): Promise<string | null> {
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

/** Transcribe a voice note via OpenAI Whisper (requires OPENAI_API_KEY). */
async function transcribeVoice(content: string): Promise<string | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;

  const audioRes = await fetch(content);
  if (!audioRes.ok) return null;

  const form = new FormData();
  form.append("model", "whisper-1");
  form.append(
    "file",
    new Blob([await audioRes.arrayBuffer()], { type: "audio/mpeg" }),
    "note.mp3",
  );

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { text?: string };
  return data.text ?? null;
}

/** Ask DeepSeek for the strict JSON extraction contract. */
async function extractWithDeepSeek(
  prompt: string,
): Promise<AiExtractedProperty | null> {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) return null;

  const res = await fetch(
    Deno.env.get("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: Deno.env.get("DEEPSEEK_MODEL") ?? "deepseek-chat",
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content:
              "Eres un extractor de datos inmobiliarios del mercado mexicano. " +
              "Extrae del texto el JSON estricto con estas claves y SOLO estas claves: " +
              "titulo (string), precio (number, MXN), recamaras (int o null), banos (int o null), " +
              "amenidades_array (array de strings), puntos_fuertes_bento (array de 1-6 strings cortos, " +
              "cada uno destaca un punto fuerte visual para tarjetas Bento), colonia (string o null), " +
              "city (string o null), precio_m2_const (number opcional, solo si el texto lo permite). " +
              "Responde únicamente JSON válido, sin texto adicional.",
          },
          { role: "user", content: prompt },
        ],
      }),
    },
  );

  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content?.trim() ?? null;
  if (!raw) return null;

  try {
    return aiExtractedPropertySchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const body = REQUEST_SCHEMA.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return json({ error: "Invalid request body", details: body.error.flatten() }, 400);
  }
  const { source, content } = body.data;

  // 1. Normalize the input into a single prompt payload.
  let prompt: string;
  if (source === "url") {
    if (!/^https?:\/\//i.test(content)) {
      return json({ error: "content must be an http(s) URL" }, 400);
    }
    const page = await extractTextFromUrl(content);
    if (!page) {
      return json({ error: "Could not fetch or parse the URL" }, 422);
    }
    prompt = `FUENTE: URL publicada en Facebook Marketplace.\nURL: ${content}\n\nCONTENIDO:\n${page}`;
  } else if (source === "voice") {
    const transcript = await transcribeVoice(content);
    if (!transcript) {
      return json(
        { error: "Voice transcription unavailable — set OPENAI_API_KEY or use text/url" },
        501,
      );
    }
    prompt = `FUENTE: Nota de voz de un vendedor inmobiliario.\n\nTRANSCRIPCION:\n${transcript}`;
  } else {
    prompt = `FUENTE: Texto libre de un vendedor inmobiliario.\n\nTEXTO:\n${content}`;
  }

  // 2. Extract with DeepSeek.
  const extracted = await extractWithDeepSeek(prompt);
  if (!extracted) {
    return json(
      { error: "AI extraction failed — set DEEPSEEK_API_KEY and try again" },
      502,
    );
  }

  return json({ ok: true, extracted });
});
