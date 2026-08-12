import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { Json } from "@/modules/lib/database.types";

export const runtime = "nodejs";

/**
 * Public analytics beacon for digital flyers.
 * Anonymous visitors POST section-view + time-spent signals here; the
 * payload is validated at the API boundary without requiring auth.
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Cuerpo JSON no válido." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return Response.json({ ok: false, error: "El cuerpo debe ser un objeto JSON." }, { status: 400 });
  }

  const flyerId = typeof body.flyerId === "string" ? body.flyerId : "";
  const visitorSessionId =
    typeof body.visitorSessionId === "string" ? body.visitorSessionId : "";
  if (!flyerId || !visitorSessionId) {
    return Response.json(
      { ok: false, error: "Se requieren flyerId y visitorSessionId." },
      { status: 400 },
    );
  }

  const timeSpentSeconds =
    typeof body.timeSpentSeconds === "number"
      ? Math.max(0, Math.min(86_400, Math.round(body.timeSpentSeconds)))
      : 0;
  const sectionsViewed = isRecord(body.sectionsViewed) ? body.sectionsViewed : {};

  const supabase = await createSupabaseServerClient();

  // Upsert: one analytics row per visitor session so repeat beacons
  // accumulate time instead of duplicating visits.
  const { data: existing } = await supabase
    .from("flyer_analytics")
    .select("id, time_spent_seconds, sections_viewed")
    .eq("flyer_id", flyerId)
    .eq("visitor_session_id", visitorSessionId)
    .returns<
      { id: string; time_spent_seconds: number | null; sections_viewed: unknown }[]
    >()
    .limit(1);

  const prev = existing?.[0];

  if (prev) {
    const { error } = await supabase
      .from("flyer_analytics")
      .update({
        time_spent_seconds: Math.max(prev.time_spent_seconds ?? 0, timeSpentSeconds),
        sections_viewed: mergeSections(prev.sections_viewed, sectionsViewed),
      })
      .eq("id", prev.id);

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true, data: { id: prev.id } });
  }

  // Generate the id server-side so the beacon can report it back without
  // needing to read the inserted row. Anonymous visitors have no SELECT
  // policy on flyer_analytics, so `insert().select().single()` would fail
  // RLS even though the INSERT itself is allowed.
  const id = crypto.randomUUID();
  const { error } = await supabase.from("flyer_analytics").insert({
    id,
    flyer_id: flyerId,
    visitor_session_id: visitorSessionId,
    time_spent_seconds: timeSpentSeconds,
    sections_viewed: toJson(sectionsViewed),
  });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, data: { id } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJson(value: Record<string, unknown>): Json {
  // Only scalar JSON values are accepted by the column type; section view
  // counters are all numbers by construction.
  const out: Record<string, Json | undefined> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val !== null && typeof val !== "object") {
      out[key] = val as Json;
    }
  }
  return out;
}

function mergeSections(
  prev: unknown,
  next: Record<string, unknown>,
): Json {
  const merged: Record<string, unknown> = isRecord(prev) ? { ...prev } : {};
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === "number") {
      merged[key] = Math.max(
        typeof merged[key] === "number" ? (merged[key] as number) : 0,
        value,
      );
    }
  }
  return toJson(merged);
}
