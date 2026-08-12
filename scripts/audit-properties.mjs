#!/usr/bin/env node
/**
 * audit-properties.mjs — audit contact data and photo provenance for all
 * property listings on the site.
 *
 * Read-only. Queries every property via the Supabase REST API (service role)
 * and produces a JSON report with:
 *
 *   - Contact completeness per listing (complete / partial / missing),
 *   - Photo origin per listing (image host of each URL),
 *   - Aggregate summary (totals, hosts distribution, gap counts).
 *
 * Usage:
 *   node scripts/audit-properties.mjs [--out path]
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local — fall back to ambient env vars.
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const outPath =
  (args[args.indexOf("--out") + 1] ?? null) ||
  join(ROOT, "scripts", "audit-report.json");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

async function fetchAll() {
  const rows = [];
  for (let page = 0; ; page++) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/properties?select=id,title,status,source_url,images,contact_name,contact_type,contact_phone,contact_whatsapp,contact_email&order=id&limit=1000&offset=${page * 1000}`,
      { headers },
    );
    if (!r.ok) throw new Error(`GET failed: ${r.status} ${await r.text()}`);
    const batch = await r.json();
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

function contactStatus(row) {
  const has = (v) => typeof v === "string" && v.trim() !== "";
  const name = has(row.contact_name);
  const phone = has(row.contact_phone);
  const email = has(row.contact_email);
  const whatsapp = has(row.contact_whatsapp);
  if (name && phone) return "complete";
  if (name || phone) return "partial";
  return "missing";
}

function imageOrigin(url) {
  try {
    return new URL(url).host;
  } catch {
    return "INVALID_URL";
  }
}

async function main() {
  const rows = await fetchAll();
  console.log(`Rows: ${rows.length} properties`);

  const summary = {
    total: rows.length,
    statuses: { complete: 0, partial: 0, missing: 0 },
    contact_fields: {
      contact_name: 0,
      contact_type: 0,
      contact_phone: 0,
      contact_whatsapp: 0,
      contact_email: 0,
    },
    images: {
      total_urls: 0,
      unique_urls: 0,
      properties_with_images: 0,
      properties_without_images: 0,
      hosts: {},
    },
    provenance: {
      properties_with_source_url: 0,
      properties_without_source_url: 0,
    },
  };

  const detail = rows.map((row) => {
    const images = Array.isArray(row.images) ? row.images : [];
    const origins = images.map(imageOrigin);
    for (const host of origins) {
      summary.images.hosts[host] = (summary.images.hosts[host] ?? 0) + 1;
    }
    const status = contactStatus(row);
    summary.statuses[status]++;
    if (row.contact_name) summary.contact_fields.contact_name++;
    if (row.contact_type) summary.contact_fields.contact_type++;
    if (row.contact_phone) summary.contact_fields.contact_phone++;
    if (row.contact_whatsapp) summary.contact_fields.contact_whatsapp++;
    if (row.contact_email) summary.contact_fields.contact_email++;
    summary.images.total_urls += images.length;
    summary.images.properties_with_images += images.length > 0 ? 1 : 0;
    summary.images.properties_without_images += images.length === 0 ? 1 : 0;
    if (row.source_url) summary.provenance.properties_with_source_url++;
    else summary.provenance.properties_without_source_url++;

    return {
      id: row.id,
      title: row.title ?? null,
      status: row.status ?? null,
      source_url: row.source_url ?? null,
      contact: {
        status,
        name: row.contact_name ?? null,
        type: row.contact_type ?? null,
        phone: row.contact_phone ?? null,
        whatsapp: row.contact_whatsapp ?? null,
        email: row.contact_email ?? null,
      },
      images: {
        count: images.length,
        origins,
        urls: images,
      },
      flags: [
        status === "missing" ? "missing_contact" : null,
        status === "partial" ? "partial_contact" : null,
        !row.source_url ? "missing_source_url" : null,
        images.length === 0 ? "no_images" : null,
      ].filter(Boolean),
    };
  });

  summary.images.unique_urls = new Set(
    rows.flatMap((r) => (Array.isArray(r.images) ? r.images : [])),
  ).size;

  const report = {
    generated_at: new Date().toISOString(),
    scope: "all properties",
    summary,
    detail,
  };

  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nSummary:`);
  console.log(`  Total properties: ${summary.total}`);
  console.log(`  Contact: complete=${summary.statuses.complete} partial=${summary.statuses.partial} missing=${summary.statuses.missing}`);
  console.log(`  Images: ${summary.images.total_urls} urls / ${summary.images.unique_urls} unique across ${summary.images.properties_with_images} properties`);
  console.log(`  Hosts: ${JSON.stringify(summary.images.hosts)}`);
  console.log(`  Provenance: ${summary.provenance.properties_with_source_url}/${summary.total} have source_url`);
  console.log(`\nReport written to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
