#!/usr/bin/env node
/**
 * Backfill embeddings for all active properties using the service role key.
 *
 * Requires: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage:
 *   node scripts/backfill-embeddings.mjs
 *
 * Idempotent: rows that already have an embedding are skipped.
 */
import { createClient } from "@supabase/supabase-js";

// Node >=20.12 loads .env.local without a dotenv dependency.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local — fall back to ambient env vars.
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const openaiKey = process.env.OPENAI_API_KEY ?? "";

if (!supabaseUrl || !serviceKey || !openaiKey) {
  console.error(
    "Missing env: set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and OPENAI_API_KEY.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function embedText(text) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data?.[0]?.embedding ?? null;
}

function embeddingText(property) {
  return [
    property.title,
    property.description ?? "",
    property.colonia ?? "",
    property.city ?? "",
    property.address ?? "",
    Array.isArray(property.amenidades) ? property.amenidades.join(", ") : "",
    Array.isArray(property.puntos_fuertes_bento)
      ? property.puntos_fuertes_bento.join(", ")
      : "",
  ]
    .filter(Boolean)
    .join(". ");
}

const { data: rows, error } = await supabase
  .from("properties")
  .select("id, title, description, colonia, city, address, amenidades, puntos_fuertes_bento, embedding, status");

if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

let embedded = 0;
let skipped = 0;
let failed = 0;

for (const property of rows ?? []) {
  if (property.embedding) {
    skipped += 1;
    continue;
  }
  const vector = await embedText(embeddingText(property));
  if (!vector) {
    failed += 1;
    continue;
  }
  const { error: updateError } = await supabase
    .from("properties")
    .update({ embedding: vector })
    .eq("id", property.id);
  if (updateError) {
    failed += 1;
    continue;
  }
  embedded += 1;
  console.log(`✓ ${property.id.slice(0, 8)} — ${property.title}`);
}

console.log(`\nDone: ${embedded} embedded, ${skipped} skipped, ${failed} failed.`);
