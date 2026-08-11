"use server";

import { revalidatePath } from "next/cache";

import { requireUserOrThrow } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { fail, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import { ingestionRequestSchema } from "@/modules/lib/schemas";
import type { AiExtractedProperty } from "@/modules/lib/schemas";
import { buildUniqueSlug } from "@/modules/listings/slug";
import { extractProperty } from "@/modules/ingestion/server";

export type ImportResult = {
  propertyId: string;
  flyerId: string;
  flyerSlug: string;
  extracted: AiExtractedProperty;
};

/**
 * Multimodal property import (Stage 2).
 *
 * Accepts a Facebook Marketplace URL, unstructured text, or a voice note,
 * runs DeepSeek extraction (via the `import-property-ai` edge function when
 * deployed, with an in-process fallback), persists the listing as a draft,
 * and auto-creates a shareable digital flyer.
 *
 * Returns the created flyer slug so the client can redirect to it instantly.
 */
export async function importPropertyFromUrl(
  input: Record<string, unknown>,
): Promise<ActionResult<ImportResult>> {
  const user = await requireUserOrThrow();
  const parsed = parseInput(ingestionRequestSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  // 1. Extract structured data with AI.
  const extracted = await extractProperty(parsed.data.source, parsed.data.content);
  if (!extracted) {
    return fail(
      "AI extraction failed. Add your DEEPSEEK_API_KEY, or paste a richer description with the price and address.",
    );
  }

  const supabase = await createSupabaseServerClient();

  // 2. Persist the listing as a draft (owner completes wizard before publish).
  const slug = await buildUniqueSlug(extracted.titulo, async (candidate) => {
    const { data } = await supabase
      .from("properties")
      .select("id")
      .eq("slug", candidate)
      .limit(1);
    return (data?.length ?? 0) > 0;
  });

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .insert({
      owner_id: user.id,
      title: extracted.titulo,
      slug,
      status: "draft",
      current_wizard_step: 1,
      type: "sale",
      price: extracted.precio,
      currency: "MXN",
      recamaras: extracted.recamaras,
      banos: extracted.banos,
      amenidades: extracted.amenidades_array,
      puntos_fuertes_bento: extracted.puntos_fuertes_bento,
      colonia: extracted.colonia ?? "",
      city: extracted.city ?? "",
      source_url: parsed.data.source === "url" ? parsed.data.content : null,
      description: `Importado automáticamente. ${
        extracted.puntos_fuertes_bento.join(" · ") || "Revisa los detalles en el wizard."
      }`,
    })
    .select("id")
    .single();

  if (propertyError) {
    return fail(propertyError.message);
  }

  // 3. Auto-create the public digital flyer (Single Live Link).
  const flyerSlug = `${user.id.slice(0, 8)}-${property.id.slice(0, 8)}`;

  const { data: flyer, error: flyerError } = await supabase
    .from("digital_flyers")
    .insert({
      property_id: property.id,
      agent_id: user.id,
      slug: flyerSlug,
      custom_title: extracted.titulo,
    })
    .select("id, slug")
    .single();

  if (flyerError) {
    return fail(flyerError.message);
  }

  revalidatePath("/my-listings");
  revalidatePath("/my-flyers");

  return ok({
    propertyId: property.id,
    flyerId: flyer.id,
    flyerSlug: flyer.slug,
    extracted,
  });
}
