#!/usr/bin/env node
/**
 * extract-43-pagina.mjs — extract venta listings (≤ $3,000,000 MXN) from the
 * `?pagina=N` pagination captures of
 *   https://propiedades.com/chihuahua-chihuahua/{categoria}
 *
 * Handles schema-3 `.properties-list` cards (2019 era). Renta listings on
 * generic category pages are filtered out by the `-en-venta-` URL check.
 *
 * Output: JSONL matching the import-propiedades.mjs contract.
 *
 * Usage: node scripts/extract-43-pagina.mjs [--out file.jsonl] [--dir /tmp/captures-43]
 */
import fs from "node:fs";

const MAX_PRICE = 3_000_000;
const CAPTURE_DIR = process.argv.find((a) => a.startsWith("--dir="))?.split("=")[1] ?? "/tmp/captures-43";
const OUT =
  process.argv.find((a) => a.startsWith("--out="))?.split("=")[1] ??
  ".scrape/propiedades-com/dataset-43-pagina.jsonl";

const CATEGORY_TYPES = {
  "casas-venta": "Casa",
  "departamentos-venta": "Departamento",
  "locales-venta": "Local",
  "comercial-venta": "Local",
  "residencial-venta": "Casa",
  "oficinas-venta": "Oficina",
  "ranchos-venta": "Rancho",
  "naves-industriales-venta": "Bodega",
  "edificios-venta": "Edificio",
  "terrenos-comerciales-venta": "Terreno comercial",
  "bodegas-comerciales-venta": "Bodega",
  "bodegas-industriales-venta": "Bodega",
  "terrenos-habitacionales-venta": "Terreno",
  "terrenos-industriales-venta": "Terreno",
  // generic category pages (no -venta suffix)
  casas: "Casa",
  departamentos: "Departamento",
  locales: "Local",
  comercial: "Local",
  residencial: "Casa",
  oficinas: "Oficina",
  ranchos: "Rancho",
  edificios: "Edificio",
  "terrenos-comerciales": "Terreno comercial",
  "bodegas-comerciales": "Bodega",
  "bodegas-industriales": "Bodega",
  "terrenos-habitacionales": "Terreno",
};

/** Parse "$ 7.5 mil MN", "$ 2 MDP", "$ 1,250,000 MXN", "3,400,000". */
function parsePrice(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/\s+/g, " ").trim();
  const m = s.match(/([\d.,]+)\s*(mil|MDP|MDD|MXN|MN|USD|Dólares|pesos)?/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(num)) return null;
  const unit = (m[2] || "").toLowerCase();
  if (unit === "mil") return Math.round(num * 1000);
  if (unit === "mdp") return Math.round(num * 1_000_000);
  if (unit === "mdd") return Math.round(num * 1_000_000 * 17); // millones de dólares → MXN
  return Math.round(num);
}

/** Extract capture date from "chihuahua-chihuahua-casas-venta-p2-20190428.html" → 2019-04-28. */
function extractCaptureDate(f) {
  const m = f.match(/-(\d{8})\.html$/);
  if (!m) return null;
  const d = m[1];
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

/**
 * Extract the category slug from "chihuahua-chihuahua-casas-venta-p2-20190428.html"
 * → "casas-venta". The generic "venta" pages (no category) map to null.
 */
function extractCategory(f) {
  const m = f.match(/^chihuahua-chihuahua-(.+?)-p\d+-\d{8}\.html$/);
  if (!m) return null;
  return m[1];
}

function cleanColonia(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/^(.*col\.?\s+)/i, "")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ *
 *  Schema-3 (2018–2021): server-rendered .properties-list cards
 * ------------------------------------------------------------------ */

function extractSchema3(html, captureDate, category) {
  const items = [];
  const parts = html.split('<div class="properties-list"');
  for (const part of parts.slice(1)) {
    const hrefM = part.match(/data-href="(https:\/\/propiedades\.com\/inmuebles\/[^"]+)"/);
    if (!hrefM) continue;
    const url = hrefM[1].split("#")[0].replace(/^web\.archive\.org.*?https?:\/\//, "").replace(/^https?:\/\/web\.archive\.org\/web\/\d+\//, "");
    if (!url.includes("-en-venta-")) continue;

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

    const streetM = part.match(/itemprop="streetAddress">\s*(?:<a[^>]*>)?\s*([^<\n]+)\s*<\/a>/);
    const street = streetM ? streetM[1].replace(/\t/g, "").trim() : "";

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

    const typeLabel = propertyType || CATEGORY_TYPES[category] || "casa";
    items.push({
      listing_id_propiedades: id,
      title: `Se vende ${typeLabel.toLowerCase()} en ${neighborhood || "Chihuahua"}, Chihuahua, ID: ${id}`,
      url: `https://propiedades.com/inmuebles/${url.split("/inmuebles/")[1] || url}`,
      price,
      price_currency: "MXN",
      operation_type: "Venta",
      property_type: propertyType || CATEGORY_TYPES[category] || "Casa",
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
      _capture: `${category}-${captureDate?.replace(/-/g, "")}`,
    });
  }
  return items;
}

/* ------------------------------------------------------------------ *
 *  Schema-2 (2015–2016): old S3 .listado-lista cards
 * ------------------------------------------------------------------ */

function extractSchema2(html, captureDate, category) {
  const items = [];
  // Each card starts with <div class="listado-lista " data-id='NNNN' ...
  const parts = html.split(/class="listado-lista " data-id='/);
  for (const part of parts.slice(1)) {
    const idM = part.match(/^(\d+)'/);
    if (!idM) continue;
    const id = idM[1];

    const latM = part.match(/itemprop="latitude" content="([^"]*)"/);
    const lngM = part.match(/itemprop="longitude" content="([^"]*)"/);
    const latitude = latM && latM[1] && parseFloat(latM[1]) !== 0 ? parseFloat(latM[1]) : null;
    const longitude = lngM && lngM[1] && parseFloat(lngM[1]) !== 0 ? parseFloat(lngM[1]) : null;

    // URL from <meta itemprop="url" content="..."> or <a href="...">
    const urlM = part.match(/itemprop="url" content="(http[^"#]*)/) || part.match(/<a href="(http[^"#]*)/);
    let url = urlM ? urlM[1] : null;
    if (url) {
      url = url.split("#")[0].replace(/^https?:\/\/web\.archive\.org\/web\/\d+\//, "").replace(/^http:/, "https:");
    }
    if (!url || !url.includes("-en-venta-")) continue;

    const imgM = part.match(/src="(https:\/\/propiedadescom\.s3\.amazonaws\.com\/files\/[^"]+)"/);
    const image = imgM ? imgM[1] : null;

    // Colonia: <div class="colonia"><p>Colonia X</p>
    const colM = part.match(/<div class="colonia">\s*<p>Colonia\s+([^<]+)<\/p>/i) ||
                 part.match(/Colonia\s+([^<]+?)\s*<span itemprop="addressLocality">/i);
    const neighborhood = colM ? cleanColonia(colM[1]) : "";

    const streetM = part.match(/itemprop="streetAddress">([^<]+)<\/span>/);
    const street = streetM ? streetM[1].trim() : "";

    // postal code
    const pcM = part.match(/itemprop="postalCode">([^<]+)</);
    const postalCode = pcM ? pcM[1] : null;

    // info-list-prop: area + type in first data-value block, beds, baths
    const infoM = part.match(/<div class="info-list-prop">([\s\S]*?)<\/div>\s*<span class="view-prop">/);
    const infoBlock = infoM ? infoM[1] : part;

    const sizeM = infoBlock.match(/<b>\s*([\d.,]+)\s*<\/b>\s*m<sup>2<\/sup>\s*<span data-value="\d+">\s*([^<]+?)\s*<\/span>/);
    const areaRaw = sizeM ? sizeM[1] : null;
    const typeSpan = sizeM ? sizeM[2] : null;
    const landArea = areaRaw ? parseFloat(areaRaw.replace(/,/g, "")) : null;

    const bedM = infoBlock.match(/<b>\s*(\d+)\s*<\/b>\s*Recámaras/i);
    const bathM = infoBlock.match(/<b>\s*(\d+)\s*<\/b>\s*Baños/i);

    // Price from the price-row block (last data-value div), e.g.
    //   <div data-value="6100000.000000" data-value-min="6100000.000000">
    //   <p data-curr="" class="price-row"><b>$ 6.1 MDP</b>
    // Prefer the raw numeric data-value attribute (exact), fall back to parsing the rendered text.
    const rawPriceM = part.match(/data-value="([\d.]+)"\s*data-value-min="[\d.]+">\s*<p[^>]*class="price-row"/);
    let price = null;
    if (rawPriceM) {
      price = Math.round(parseFloat(rawPriceM[1]));
    } else {
      const priceM = part.match(/class="price-row">\s*<b>\s*([^<]+)<\/b>/);
      price = parsePrice(priceM ? priceM[1] : "");
    }
    if (price === null || !Number.isFinite(price) || price > MAX_PRICE) continue;

    // description
    const descM = part.match(/descripcion-ficha[\s\S]*?<h4>([\s\S]*?)<\/h4>/);
    const description = descM ? descM[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";

    const typeLabel = typeSpan || CATEGORY_TYPES[category] || "casa";
    items.push({
      listing_id_propiedades: id,
      title: `Se vende ${typeLabel.toLowerCase()} en ${neighborhood || "Chihuahua"}, Chihuahua, ID: ${id}`,
      url: url || `https://propiedades.com/inmuebles/${id}`,
      price,
      price_currency: "MXN",
      operation_type: "Venta",
      property_type: typeSpan || CATEGORY_TYPES[category] || "Casa",
      street_address: street,
      neighborhood: neighborhood || "",
      city: "Chihuahua",
      state: "Chihuahua",
      postal_code: postalCode,
      bedrooms: bedM ? parseInt(bedM[1], 10) : null,
      bathrooms: bathM ? parseInt(bathM[1], 10) : null,
      land_area_m2: landArea !== null && landArea !== undefined ? String(landArea) : null,
      images: image ? [image] : [],
      main_image: image,
      date_posted: captureDate,
      description,
      latitude,
      longitude,
      _capture: `${category}-${captureDate?.replace(/-/g, "")}`,
    });
  }
  return items;
}

/* ------------------------------------------------------------------ *
 *  Schema-2b (2016): `property-gallery` cards (map/list hybrid view)
 * ------------------------------------------------------------------ */

function extractSchema2b(html, captureDate, category) {
  const items = [];
  const parts = html.split(/<div class="property-gallery " data-id='/);
  for (const part of parts.slice(1)) {
    const idM = part.match(/^(\d+)'/);
    if (!idM) continue;
    const id = idM[1];

    const latM = part.match(/itemprop="latitude" content="([^"]*)"/);
    const lngM = part.match(/itemprop="longitude" content="([^"]*)"/);
    const latitude = latM && latM[1] && parseFloat(latM[1]) !== 0 ? parseFloat(latM[1]) : null;
    const longitude = lngM && lngM[1] && parseFloat(lngM[1]) !== 0 ? parseFloat(lngM[1]) : null;

    const urlM = part.match(/itemprop="url" content="(http[^"#]*)/);
    let url = urlM ? urlM[1] : null;
    if (url) {
      url = url.split("#")[0].replace(/^http:/, "https:");
    }
    if (!url || !url.includes("-en-venta-")) continue;

    const imgM = part.match(/<img class="photo-thumb[^"]*" src="(http[^"]+)"/);
    let image = imgM ? imgM[1] : null;
    if (image) image = image.replace(/^http:/, "https:");

    const streetM = part.match(/itemprop="streetAddress">([^<]+)<\/span>/);
    const street = streetM ? streetM[1].trim() : "";

    const colM = part.match(/en\s*\nColonia\s+([^<]+?)\s*<span itemprop="addressLocality">/i) ||
                 part.match(/en\s*Colonia\s+([^<]+?)\s*<span itemprop="addressLocality">/i);
    const neighborhood = colM ? cleanColonia(colM[1]) : "";

    const typeM = part.match(/<span data-value="\d+">\s*([^<]+?)\s*<\/span>\s*en\s*\n?Colonia/i);
    const typeSpan = typeM ? typeM[1].trim() : null;

    const pcM = part.match(/itemprop="postalCode">([^<]+)</);
    const postalCode = pcM ? pcM[1] : null;

    const rawPriceM = part.match(/data-value="([\d.]+)"\s*data-value-min="[\d.]+"/);
    let price = null;
    if (rawPriceM) {
      price = Math.round(parseFloat(rawPriceM[1]));
    }
    if (price === null || !Number.isFinite(price) || price > MAX_PRICE) continue;

    // gral-description list: beds/baths/size. Each <li data-value="N" ...>
    // holds an icon + value; the data-value attribute comes BEFORE the icon.
    const gralM = part.match(/<ul class="gral-description">([\s\S]*?)<\/ul>/);
    let bedrooms = null, bathrooms = null, landArea = null;
    if (gralM) {
      const lis = [...gralM[1].matchAll(/<li\s+data-value="([\d.]+)"[\s\S]*?<\/li>/g)].map((m) => ({
        value: m[1],
        chunk: m[0],
      }));
      for (const li of lis) {
        if (li.chunk.includes("icon-recamaras") && li.value !== "0") bedrooms = parseInt(li.value, 10);
        if (li.chunk.includes("icon-banos") && li.value !== "0") bathrooms = parseInt(li.value, 10);
        if (li.chunk.includes("icon-tamanoconstruccion") && li.value !== "0") landArea = li.value;
      }
    }

    const updatedM = part.match(/Actualizada el ([\d\/]+)/);
    const datePosted = updatedM ? updatedM[1].split("/").reverse().join("-") : captureDate;

    const descM = part.match(/descripcion-ficha[\s\S]*?<h4>([\s\S]*?)<\/h4>/);
    const description = descM ? descM[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";

    const typeLabel = typeSpan || CATEGORY_TYPES[category] || "casa";
    items.push({
      listing_id_propiedades: id,
      title: `Se vende ${typeLabel.toLowerCase()} en ${neighborhood || "Chihuahua"}, Chihuahua, ID: ${id}`,
      url,
      price,
      price_currency: "MXN",
      operation_type: "Venta",
      property_type: typeSpan || CATEGORY_TYPES[category] || "Casa",
      street_address: street,
      neighborhood: neighborhood || "",
      city: "Chihuahua",
      state: "Chihuahua",
      postal_code: postalCode,
      bedrooms,
      bathrooms,
      land_area_m2: landArea,
      images: image ? [image] : [],
      main_image: image,
      date_posted: datePosted,
      description,
      latitude,
      longitude,
      _capture: `${category}-${captureDate?.replace(/-/g, "")}`,
    });
  }
  return items;
}

/* ------------------------------------------------------------------ * */

const files = fs.readdirSync(CAPTURE_DIR).filter((f) => f.endsWith(".html")).sort();
const all = [];

for (const f of files) {
  const captureDate = extractCaptureDate(f);
  const category = extractCategory(f);
  const html = fs.readFileSync(`${CAPTURE_DIR}/${f}`, "utf8");
  let items;
  if (html.includes('class="properties-list"')) {
    items = extractSchema3(html, captureDate, category);
    console.log(`${f}: ${items.length} venta ≤ $3M (schema-3)`);
  } else if (html.includes('class="property-gallery " data-id=')) {
    items = extractSchema2b(html, captureDate, category);
    console.log(`${f}: ${items.length} venta ≤ $3M (schema-2b)`);
  } else {
    items = extractSchema2(html, captureDate, category);
    console.log(`${f}: ${items.length} venta ≤ $3M (schema-2)`);
  }
  all.push(...items);
}

// Dedup within the batch by listing id (keep the first occurrence).
const seen = new Map();
for (const it of all) {
  if (!seen.has(it.listing_id_propiedades)) seen.set(it.listing_id_propiedades, it);
}
const uniq = [...seen.values()];
console.log(`\nTotal: ${all.length} → unique ${uniq.length} listings`);

fs.mkdirSync(".scrape/propiedades-com", { recursive: true });
fs.writeFileSync(OUT, uniq.map((i) => JSON.stringify(i)).join("\n") + "\n");
console.log(`Wrote ${OUT}`);
