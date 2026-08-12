# /// script
# dependencies = ["beautifulsoup4", "lxml"]
# ///
import json
import re
from bs4 import BeautifulSoup

BASE = "/Users/mac/.copilot/repos/Propiedades/.scrape/.work/propiedades-com/analyze-list"

def load_jsonld_by_url(meta_path):
    d = json.load(open(meta_path))
    jl = d.get("json-ld", [])
    out = {}
    for item in jl:
        me = item.get("mainEntity", {})
        for li in me.get("itemListElement", []):
            it = li.get("item", {})
            url = it.get("url")
            if url:
                out[url] = it
    return out

def clean_num(s):
    if s is None:
        return None
    s = s.replace(",", "").replace("$", "").strip()
    try:
        if "." in s:
            return float(s)
        return int(s)
    except ValueError:
        return None

def parse_page(html_path, meta_path, page_id):
    jsonld = load_jsonld_by_url(meta_path)
    soup = BeautifulSoup(open(html_path).read(), "lxml")
    cards = soup.select("section.pcom-property-card")
    results = []
    for card in cards:
        values = {}
        extras = {}
        # link + id
        link_tag = card.select_one("a.pcom-property-card-body-main-info-street")
        url = None
        if link_tag and link_tag.get("href"):
            url = link_tag["href"].split("#")[0]
        listing_id = card.get("data-id")
        # title / h2 text
        h2 = card.select_one("h2")
        title_text = None
        street_address = None
        neighborhood = None
        city = None
        state = None
        postal_code = None
        full_address = None
        if h2:
            # streetAddress span
            street_span = h2.select_one('span[itemprop="streetAddress"]')
            if street_span:
                street_address = street_span.get("content") or street_span.get_text(strip=True)
            locality_span = h2.select_one('span[itemprop="addressLocality"]')
            if locality_span:
                city = locality_span.get("content")
            region_span = h2.select_one('span[itemprop="addressRegion"]')
            if region_span:
                state = region_span.get("content")
            postal_span = h2.select_one('span[itemprop="postalCode"]')
            if postal_span:
                postal_code = postal_span.get("content")
            full_address = h2.get_text(" ", strip=True)
            title_text = h2.get_text(" ", strip=True)

        # price
        price_div = card.select_one(".pcom-property-card-body-main-info-street-id")
        price_container = card.select_one(".sc-a144be82-2, [class*='hwDpnI']")
        price_formatted = None
        price = None
        price_currency = None
        # price text is usually just before the address div, find via main-info div
        main_info = card.select_one("section.pcom-property-card-body-main-info")
        if main_info:
            # first direct div child text before the link
            first_div = main_info.find("div", recursive=False)
            if first_div:
                txt = first_div.get_text(" ", strip=True)
                price_formatted = txt
                m = re.search(r"\$([\d,]+)", txt)
                if m:
                    price = clean_num(m.group(1))
                cur = first_div.select_one(".currency")
                if cur:
                    price_currency = cur.get_text(strip=True)

        # operation type / property type from section-labels
        labels = [d.get_text(strip=True) for d in card.select(".section-labels div")]
        property_type = labels[0] if len(labels) > 0 else None
        operation_type = labels[1] if len(labels) > 1 else None

        # amenities: area(s), bedrooms, bathrooms
        land_area_m2 = None
        built_area_m2 = None
        bedrooms = None
        bathrooms = None
        area_values = []
        for li in card.select("ul.dHoQuP li.amenities, ul[class*='dHoQuP'] li.amenities"):
            count_span = li.select_one(".amenities-count")
            label_span = li.select_one(".amenities-label")
            if not count_span:
                continue
            val = count_span.get_text(strip=True)
            if label_span:
                label = label_span.get_text(strip=True).lower()
                if "recámara" in label or "recamara" in label:
                    bedrooms = clean_num(val)
                elif "baño" in label or "bano" in label:
                    bathrooms = clean_num(val)
            else:
                # this is m2 area value (no label span, has sup m2)
                area_values.append(clean_num(val))

        if len(area_values) == 1:
            land_area_m2 = area_values[0]
        elif len(area_values) >= 2:
            land_area_m2 = area_values[0]
            built_area_m2 = area_values[1]

        # is_featured
        is_featured = None
        featured_div = card.select_one(".labels-highlighted")
        if featured_div:
            is_featured = featured_div.get_text(strip=True)

        # images
        images = []
        for img in card.select("img[src]"):
            src = img.get("src")
            if src and src.startswith("http"):
                images.append(src)
        main_image = images[0] if images else None

        values.update({
            "title": title_text,
            "url": url,
            "listing_id_propiedades": listing_id,
            "price": price,
            "price_currency": price_currency,
            "price_formatted": price_formatted,
            "operation_type": operation_type,
            "property_type": property_type,
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,
            "land_area_m2": land_area_m2,
            "built_area_m2": built_area_m2,
            "street_address": street_address,
            "neighborhood": neighborhood,
            "city": city,
            "state": state,
            "postal_code": postal_code,
            "full_address": full_address,
            "images": images,
            "main_image": main_image,
            "is_featured": is_featured,
        })

        # merge JSON-LD if matching url found
        jl = jsonld.get(url) if url else None
        if jl:
            offers = jl.get("offers", {})
            item_offered = offers.get("itemOffered", {})
            address = item_offered.get("address", {})
            geo = item_offered.get("geo", {})
            values["date_posted"] = jl.get("datePosted")
            if offers.get("price") is not None:
                values["price"] = offers.get("price")
            if offers.get("priceCurrency"):
                values["price_currency"] = offers.get("priceCurrency")
            if item_offered.get("description"):
                values["description"] = item_offered.get("description")
            if address.get("streetAddress"):
                values["full_address"] = address.get("streetAddress")
            if address.get("addressLocality"):
                values["city"] = address.get("addressLocality")
            if address.get("addressRegion"):
                values["state"] = address.get("addressRegion")
            if address.get("postalCode"):
                values["postal_code"] = address.get("postalCode")
            if geo.get("latitude"):
                values["latitude"] = clean_num(str(geo.get("latitude")))
            if geo.get("longitude"):
                values["longitude"] = clean_num(str(geo.get("longitude")))
            if item_offered.get("image"):
                jl_images = item_offered.get("image")
                if isinstance(jl_images, list) and jl_images:
                    values["images"] = list(dict.fromkeys(values["images"] + jl_images))
                    values["main_image"] = values["images"][0]
            if item_offered.get("name"):
                extras["place_name"] = item_offered.get("name")

        # try neighborhood extraction from full_address / street_address (Col. X)
        addr_source = values.get("full_address") or full_address or ""
        m = re.search(r"Col\.\s*([^,C]+?)(?:\s*C\.P\.|,|$)", addr_source)
        if m:
            values["neighborhood"] = m.group(1).strip()

        # remove None values
        values = {k: v for k, v in values.items() if v not in (None, [], "")}
        extras = {k: v for k, v in extras.items() if v not in (None, [], "")}
        values.update(extras)

        if not url and not title_text:
            continue

        results.append({
            "url": url,
            "page_id": page_id,
            "values": values,
        })
    return results

all_results = []
all_results += parse_page(f"{BASE}/list-1.raw.cleaned.html", f"{BASE}/list-1.raw.metadata.json", "list-1")
all_results += parse_page(f"{BASE}/list-2.raw.cleaned.html", f"{BASE}/list-2.raw.metadata.json", "list-2")

with open(f"{BASE}/listings.json", "w") as f:
    json.dump(all_results, f, ensure_ascii=False, indent=2)

print("list-1 count:", sum(1 for r in all_results if r["page_id"] == "list-1"))
print("list-2 count:", sum(1 for r in all_results if r["page_id"] == "list-2"))
print("total:", len(all_results))
