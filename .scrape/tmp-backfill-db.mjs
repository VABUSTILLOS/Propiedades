import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { createInterface } from "node:readline";

const env = readFileSync(".env.local", "utf8");
const get = (k) => { const m = env.match(new RegExp(`^${k}=(.+)$`, "m")); return m ? m[1].trim() : null; };
const supabase = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));

// Read all JSONL lines from the crawl output
const lines = readFileSync(".scrape/backfill-output.jsonl", "utf8")
  .split("\n").filter((l) => l.trim());
console.log(`items scraped: ${lines.length}`);

let updated = 0, skippedNoImages = 0, notFound = 0, errors = 0;

for (const line of lines) {
  let item;
  try { item = JSON.parse(line); } catch (e) { console.error("bad line:", line.slice(0,80)); continue; }
  const lid = item.listing_id_vivanuncios;
  const images = Array.isArray(item.images) ? item.images : null;
  if (!lid) { console.error("no listing_id for", item.url); errors++; continue; }
  if (!images || images.length === 0) { console.log(`skip ${lid} (no images)`); skippedNoImages++; continue; }

  // Normalize size to 720x480 for consistency? We keep 1200x1200 (higher res). Leave as-is.
  const { data, error } = await supabase
    .from("properties")
    .update({ images })
    .eq("source_url", item.url);

  if (error) {
    // Try matching by listing id in source_url
    const { data: d2, error: e2 } = await supabase
      .from("properties")
      .update({ images })
      .like("source_url", `%/${lid}%`);
    if (e2) { console.error(`ERROR ${lid}: ${e2.message}`); errors++; }
    else if (d2?.count === 0) { console.log(`not found ${lid}`); notFound++; }
    else { updated++; }
  } else {
    updated++;
  }
}

console.log(`\nupdated: ${updated}, skippedNoImages: ${skippedNoImages}, notFound: ${notFound}, errors: ${errors}`);
