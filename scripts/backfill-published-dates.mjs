#!/usr/bin/env node
/**
 * Backfill created_at for scraped Vivanuncios listings whose tile had no
 * "Publicado" label (pages 2+ fetched without sort). The detail page always
 * shows the real relative date (e.g. "Publicado hace 58 días"), so we fetch
 * each detail page, extract it, and PATCH created_at so the homepage ordering
 * (created_at desc) reflects true recency.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JINA_API_KEY.
 *
 * Usage:
 *   node scripts/backfill-published-dates.mjs <file-with-source-urls>
 *   # or without args: scans ALL active properties with source_url like
 *   # %vivanuncios.com.mx% and backfills any whose date is unknown.
 */
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // ambient env
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const JINA_API_KEY = process.env.JINA_API_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !JINA_API_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JINA_API_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** True when Jina returned a Cloudflare challenge instead of the page. */
function isCloudflareBlocked(text) {
  if (!text) return true;
  return (
    /<title>\s*Just a moment/i.test(text) ||
    /"Just a moment\.\.\."/.test(text) ||
    /Performing security verification/i.test(text) ||
    text.length < 2000
  );
}

async function jinaFetchMarkdown(url, retries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch("https://r.jina.ai/" + url, {
        headers: {
          Authorization: `Bearer ${JINA_API_KEY}`,
          "X-Return-Format": "markdown",
          "X-Timeout": "60",
        },
      });
      if (!res.ok) {
        lastErr = new Error(`Jina HTTP ${res.status}`);
        await sleep(3000 * attempt);
        continue;
      }
      const text = await res.text();
      if (isCloudflareBlocked(text)) {
        lastErr = new Error("Cloudflare challenge returned");
        await sleep(3000 * attempt);
        continue;
      }
      return text;
    } catch (err) {
      lastErr = err;
      await sleep(3000 * attempt);
    }
  }
  throw lastErr ?? new Error("Jina fetch failed");
}

/**
 * Extract relative published days from detail markdown.
 * Accepts: "Publicado hoy", "Publicado desde ayer", "Publicado hace N días",
 * "Publicado hace N horas", and a couple of absolute variants.
 * Returns days ago (number) or null when unknown.
 */
function daysFromMarkdown(md) {
  if (!md) return null;
  // Relative labels anywhere in the text (details pages show "Publicado hace 58 días").
  const rel = md.match(/Publicado\s+(hoy|desde ayer|hace\s+\d+\s+(?:días?|horas?|minutos?))/i);
  if (rel) {
    const label = rel[0].replace(/^Publicado\s+/i, "").toLowerCase();
    if (label === "hoy") return 0;
    if (label === "desde ayer") return 1;
    const n = label.match(/hace\s+(\d+)\s+(días?|horas?|minutos?)/i);
    if (n) {
      const count = parseInt(n[1], 10);
      const unit = n[2].toLowerCase();
      if (unit.startsWith("día")) return count;
      if (unit.startsWith("hora")) return Math.max(0, Math.round(count / 24));
      if (unit.startsWith("minuto")) return 0;
    }
  }
  // Absolute date fallback: "Publicado 12/08/2026" or "Publicado el 12 de agosto de 2026".
  const abs = md.match(/Publicado(?: el)?\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
  if (abs) {
    const d = new Date(`${abs[3]}-${abs[2].padStart(2, "0")}-${abs[1].padStart(2, "0")}`);
    if (!Number.isNaN(d.getTime())) {
      const diff = Date.now() - d.getTime();
      return Math.max(0, Math.floor(diff / 86400000));
    }
  }
  const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const absES = md.match(/Publicado(?: el)?\s+(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i);
  if (absES) {
    const mi = months.findIndex((m) => m.startsWith(absES[2].toLowerCase()));
    if (mi >= 0) {
      const d = new Date(`${absES[3]}-${String(mi + 1).padStart(2, "0")}-${absES[1].padStart(2, "0")}`);
      if (!Number.isNaN(d.getTime())) {
        const diff = Date.now() - d.getTime();
        return Math.max(0, Math.floor(diff / 86400000));
      }
    }
  }
  return null;
}

function createdFromPublished(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/** Fetch rows to fix. Either explicit URLs file or all vivanuncios actives. */
async function fetchTargets(sourceFile) {
  if (sourceFile) {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(sourceFile, "utf8");
    const urls = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const rows = [];
    for (const url of urls) {
      const { data } = await supabase
        .from("properties")
        .select("id, source_url, created_at")
        .eq("source_url", url)
        .maybeSingle();
      if (data) rows.push(data);
      else console.log(`  (no row for ${url})`);
    }
    return rows;
  }
  const { data, error } = await supabase
    .from("properties")
    .select("id, source_url, created_at")
    .like("source_url", "%vivanuncios.com.mx%")
    .eq("status", "active");
  if (error) throw error;
  return data ?? [];
}

async function main() {
  const sourceFile = process.argv[2];
  const targets = await fetchTargets(sourceFile);
  console.log(`Targets: ${targets.length}`);

  let fixed = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const row = targets[i];
    console.log(`\n[${i + 1}/${targets.length}] ${row.source_url}`);
    let md = null;
    try {
      md = await jinaFetchMarkdown(row.source_url);
    } catch (err) {
      console.log(`  detalle no disponible (${err.message}) — skip`);
      failed++;
      continue;
    }
    const days = daysFromMarkdown(md);
    if (days === null) {
      console.log(`  fecha no encontrada en detalle — skip`);
      skipped++;
      continue;
    }
    const created_at = createdFromPublished(days);
    const { error } = await supabase
      .from("properties")
      .update({ created_at })
      .eq("id", row.id);
    if (error) {
      console.error(`  ERROR: ${error.message}`);
      failed++;
      continue;
    }
    console.log(`  ✓ created_at → ${created_at} (hace ${days} días)`);
    fixed++;
    await sleep(1500);
  }

  console.log(`\n=== Resumen ===`);
  console.log(`Actualizados: ${fixed}`);
  console.log(`Sin fecha en detalle: ${skipped}`);
  console.log(`Fallos (Jina/DB): ${failed}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
