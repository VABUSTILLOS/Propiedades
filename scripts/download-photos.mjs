#!/usr/bin/env node
/**
 * download-photos.mjs — download listing photos and host them locally.
 *
 * For each property with remote images:
 *   1. Downloads each image URL (best-effort, with retries),
 *   2. Uploads it to Supabase Storage (bucket `property-images`) at
 *      property-images/{property_id}/{index}.jpg,
 *   3. PATCHes the row so `images` holds the local public URLs (same order)
 *      and `image_sources` holds the original URLs (same order).
 *
 * Provenance is preserved: image_sources[i] is always the original source of
 * images[i], before and after the swap to local hosting.
 *
 * Usage:
 *   node scripts/download-photos.mjs [--property=<id>] [--limit=<n>] [--dry-run]
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
const onlyProperty = args.find((a) => a.startsWith("--property="))?.split("=")[1] ?? null;
const limit = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0", 10) || 0;
const dryRun = args.includes("--dry-run");

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

const bucket = "property-images";
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

async function fetchAll() {
  const rows = [];
  let selector =
    "select=id,title,status,source_url,images,image_sources&order=id&limit=1000&offset=";
  if (onlyProperty) selector = `select=id,title,status,source_url,images,image_sources&id=eq.${onlyProperty}`;
  for (let page = 0; ; page++) {
    const url = onlyProperty
      ? `${SUPABASE_URL}/rest/v1/properties?${selector}`
      : `${SUPABASE_URL}/rest/v1/properties?${selector}${page * 1000}`;
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`GET failed: ${r.status} ${await r.text()}`);
    const batch = await r.json();
    rows.push(...batch);
    if (onlyProperty || batch.length < 1000) break;
  }
  return rows;
}

async function patchRow(id, patch) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`PATCH ${id} failed: ${r.status} ${await r.text()}`);
}

async function downloadImage(url, attempt = 1) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 1024) throw new Error(`tiny body (${buf.length}b)`);
    return buf;
  } catch (e) {
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((res) => setTimeout(res, 1000 * attempt));
      return downloadImage(url, attempt + 1);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function uploadImage(propertyId, index, buf) {
  const path = `${propertyId}/${index}.jpg`;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "image/jpeg",
      "x-upsert": "true",
    },
    body: buf,
  });
  if (!r.ok) throw new Error(`upload ${path} failed: ${r.status} ${await r.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

async function main() {
  const rows = await fetchAll();
  if (limit) rows.length = Math.min(rows.length, limit);
  console.log(`Properties to process: ${rows.length}${dryRun ? " (dry run)" : ""}`);

  const failures = [];
  let done = 0;
  let skipped = 0;

  for (const row of rows) {
    const images = Array.isArray(row.images) ? row.images.filter(Boolean) : [];
    const sources = Array.isArray(row.image_sources) ? row.image_sources.filter(Boolean) : [];
    const alreadyLocal = images.length > 0 && images[0].includes(`/storage/v1/object/public/${bucket}/`);

    if (images.length === 0) {
      skipped++;
      continue;
    }
    if (alreadyLocal) {
      // Already migrated to local hosting — if provenance is missing we can no
      // longer recover the original remote URL from the stored data, so flag it
      // for manual review instead of writing a fabricated source.
      const missing = images.filter((url, i) => !sources[i]).length;
      if (missing === 0) {
        skipped++;
        continue;
      }
      failures.push({
        id: row.id,
        title: row.title,
        failed: missing,
        of: images.length,
        reason: "already local but image_sources missing original URLs — manual review required",
      });
      console.error(
        `  ! ${row.id.slice(0, 8)} already local with ${missing} missing provenance entries (manual review)`,
      );
      done++;
      continue;
    }

    const localImages = [];
    const newSources = [];
    let rowFailures = 0;

    for (let i = 0; i < images.length; i++) {
      const url = images[i];
      const source = sources[i] || url; // keep existing provenance when present
      try {
        let buf;
        let localUrl;
        if (dryRun) {
          buf = null;
          localUrl = `storage://${bucket}/${row.id}/${i}.jpg`;
        } else {
          buf = await downloadImage(url);
          localUrl = await uploadImage(row.id, i, buf);
        }
        localImages.push(localUrl);
        newSources.push(source);
      } catch (e) {
        rowFailures++;
        console.error(`  ✗ ${row.id.slice(0, 8)} img[${i}] ${url.slice(0, 80)} → ${e.message}`);
        localImages.push(url); // keep original on failure
        newSources.push(source);
      }
    }

    if (!dryRun) {
      await patchRow(row.id, { images: localImages, image_sources: newSources });
    }
    if (rowFailures > 0) {
      failures.push({ id: row.id, title: row.title, failed: rowFailures, of: images.length });
    } else {
      console.log(`  ✓ ${row.id.slice(0, 8)} ${images.length} images hosted locally`);
    }
    done++;
  }

  console.log(
    `\nDone: ${done} processed, ${skipped} skipped, ${failures.length} with failures.`,
  );
  if (failures.length > 0) {
    const report = join(ROOT, "scripts", "photo-download-failures.json");
    await writeFile(report, JSON.stringify({ generated_at: new Date().toISOString(), failures }, null, 2));
    console.log(`Failures written to ${report}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
