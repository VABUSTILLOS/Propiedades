#!/usr/bin/env node
/**
 * extract-41-root.mjs — extract venta listings (≤ $3,000,000 MXN) from the
 * unconsumed 2020–2022 root captures of
 *   https://propiedades.com/chihuahua-chihuahua/
 *
 * Two schemas are handled:
 *   1. 2020–2021 era: server-rendered `.properties-list` cards (schema-3)
 *   2. 2022-11-29: __NEXT_DATA__ JSON with `results.properties[]`
 *
 * Output: JSONL matching the import-propiedades.mjs contract.
 */
import fs from "node:fs";

const MAX_PRICE = 3_000_000;
const OUT = ".scrape/propiedades-com/dataset-41-root.jsonl";
const CAPTURES = fs
  .readdirSync("/tmp/captures-41")
  .filter((f) => f.endsWith(".html"))
  .sort();

/** Parse "$ 7.5 mil MN", "$ 2 MDP", "$ 1,250,000 MXN", "3,400,000". */
function parsePrice(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/\s+/g, " ").trim();
  const m = s.match(/([\d.,]+)\s*(mil|MDP|MXN|USD|Dólares|pesos)?/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(num)) return null;
  const unit = (m[2] || "").toLowerCase();
  if (unit === "mil") return Math.round(num * 1000);
  if (unit === "mdp") return Math.round(num * 1_000_000);
  return Math.round(num);
}

function extractCaptureDate(f) {
  const m = f.match(/root-(\d{8})/);
  return m ? `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)}` : null;
}

function cleanColonia(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/^(.*col\.?\s+)/i, "")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Schema-3: server-rendered .properties-list cards. */
function extractSchema3(html, captureDate) {
  const items = [];
  // split cards on the properties-list opening tag
  const parts = html.split('<div class="properties-list"');
  for (const part of parts.slice(1)) {
    const hrefM = part.match(/data-href="(https:\/\/propiedades\.com\/inmuebles\/[^"]+)"/);
    if (!hrefM) continue;
    const url = hrefM[1].split("#")[0].replace(/^web\.archive\.org.*?https?:\/\//, "").replace(/^https?:\/\/web\.archive\.org\/web\/\d+\//, "");
    if (!url.includes("-en-venta-")) continue; // user wants venta only

    const idM = url.match(/(\d+)$/);
    if (!idM) continue;
    const id = idM[1];

    const latM = part.match(/itemprop="latitude" content="([^"]*)"/);
    const lngM = part.match(/itemprop="longitude" content="([^"]*)"/);
    const latitude = latM && latM[1] ? parseFloat(latM[1]) : null;
    const longitude = lngM && lngM[1] ? parseFloat(lngM[1]) : null;

    const imgM = part.match(/data-src="([^"]+)"[^>]*alt="(Foto[^"]*)"/) || part.match(/data-src="([^"]+)"/);
    const imageRaw = imgM ? imgM[1] : null;
    const image = imageRaw ? imageRaw.replace(/^https?:\/\/web\.archive\.org\/web\/\d+\//, "").replace(/^https?:\/\/web\.archive\.org\/web\/\d+im_\//, "") : null;
    if (image && /nophoto|sin-imagen|placeholder/.test(image)) { /* keep but marked below */ }

    const streetM = part.match(/itemprop="streetAddress">\s*(?:<a[^>]*>)?\s*([^<\n]+)\s*<\/a>/);
    const street = streetM ? streetM[1].replace(/\t/g, "").trim() : "";

    // "Venta de <em>Casa</em> en Colonia X" or "Renta de ..."
    const addrM = part.match(/class="address-property\s*[^"]*">\s*Venta de\s*<em>([^<]+)<\/em>\s*en Colonia ([^<]+)/);
    let propertyType = null;
    let neighborhood = null;
    if (addrM) {
      propertyType = addrM[1].trim();
      neighborhood = addrM[2].trim();
    }

    const updatedM = part.match(/Actualizada el ([\d\/]+)/);
    const datePosted = updatedM ? updatedM[1].split("/").reverse().join("-") : captureDate;

    const bedM = part.match(/icon-recamaras"><\/i>\s*(\d+)/);
    const bathM = part.match(/icon-bano"><\/i>\s*(\d+)/);
    const sizeM = part.match(/icon-tamano-construccion"><\/i>\s*([\d.]+)/);

    const descM = part.match(/<h4>([\s\S]*?)<\/h4>/);
    const description = descM ? descM[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";

    const priceM = part.match(/<span class="price">\s*([^<]+)<\/span>/);
    const price = parsePrice(priceM ? priceM[1] : "");
    if (price === null || price > MAX_PRICE) continue;

    const typeLabel = propertyType || "casa";
    items.push({
      listing_id_propiedades: id,
      title: `Se vende ${typeLabel.toLowerCase()} en ${neighborhood || "Chihuahua"}, Chihuahua, ID: ${id}`,
      url: `https://propiedades.com/inmuebles/${url.split("/inmuebles/")[1] || url}`,
      price,
      price_currency: "MXN",
      operation_type: "Venta",
      property_type: propertyType || "Casa",
      street_address: street,
      neighborhood: neighborhood || "",
      city: "Chihuahua",
      state: "Chihuahua",
      bedrooms: bedM ? parseInt(bedM[1], 10) : null,
      bathrooms: bathM ? parseInt(bathM[1], 10) : null,
      land_area_m2: sizeM ? sizeM[1] : null,
      images: image ? [image] : [],
      main_image: image,
      date_posted: datePosted,
      description,
      latitude,
      longitude,
      _capture: `root-${captureDate?.replace(/-/g, "")}`,
    });
  }
  return items;
}

/** Schema: __NEXT_DATA__ with results.properties[]. */
function extractNextData(html, captureDate) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return [];
  let d;
  try { d = JSON.parse(m[1]); } catch { return []; }
  const props = d?.props?.pageProps?.results?.properties;
  if (!Array.isArray(props)) return [];
  const items = [];
  for (const p of props) {
    if (String(p.purpose_str ?? "").toLowerCase() !== "venta") continue;
    const price = p.price_real ?? parsePrice(p.price ?? p.price_num ?? "");
    if (!price || price > MAX_PRICE) continue;
    const url = (p.url_property ?? "").replace(/^https?:\/\/web\.archive\.org\/web\/\d+\//, "").split("#")[0];
    const id = String(p.id);
    const images = [
      (p.picture ?? "").replace(/^https?:\/\/web\.archive\.org\/web\/\d+\//, ""),
      ...(p.pictures ?? []).map((u) => String(u).replace(/^https?:\/\/web\.archive\.org\/web\/\d+\//, "")),
    ].filter(Boolean);
    const dateM = (p.published ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
    const typeLabel = p.type_str || "casa";
    const nbhood = cleanColonia(p.colony || p.address1 || "");
    items.push({
      listing_id_propiedades: id,
      title: `Se vende ${typeLabel.toLowerCase()} en ${nbhood || "Chihuahua"}, Chihuahua, ID: ${id}`,
      url: url || `https://propiedades.com/inmuebles/${id}`,
      price,
      price_currency: "MXN",
      operation_type: "Venta",
      property_type: p.type_str || "Casa",
      street_address: p.short_address || "",
      neighborhood: nbhood,
      city: p.city || "Chihuahua",
      state: p.state || "Chihuahua",
      bedrooms: p.bedrooms || null,
      bathrooms: p.bathrooms || null,
      land_area_m2: p.size_m2 || null,
      images,
      main_image: images[0] || null,
      date_posted: dateM ? dateM[1] : captureDate,
      description: p.description || "",
      latitude: p.latitude ? parseFloat(p.latitude) : null,
      longitude: p.longitude ? parseFloat(p.longitude) : null,
      _capture: `root-${captureDate?.replace(/-/g, "")}`,
    });
  }
  return items;
}

const all = [];
for (const f of CAPTURES) {
  const captureDate = extractCaptureDate(f);
  const html = fs.readFileSync(`/tmp/captures-41/${f}`, "utf8");
  const items = html.includes('__NEXT_DATA__') && html.includes('results')
    ? extractNextData(html, captureDate)
    : extractSchema3(html, captureDate);
  console.log(`${f}: ${items.length} venta ≤ $3M`);
  all.push(...items);
}

// Dedup within the batch by listing id (keep the most recent capture).
const seen = new Map();
for (const it of all) {
  if (!seen.has(it.listing_id_propiedades)) seen.set(it.listing_id_propiedades, it);
}
const uniq = [...seen.values()];
console.log(`\nTotal: ${all.length} → unique ${uniq.length} listings`);

fs.mkdirSync(".scrape/propiedades-com", { recursive: true });
fs.writeFileSync(OUT, uniq.map((i) => JSON.stringify(i)).join("\n") + "\n");
console.log(`Wrote ${OUT}`);
