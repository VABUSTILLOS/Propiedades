import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import {
  HOT_FETCH_CAP,
  searchListingsWithHot,
  type ListingWithHot,
} from "@/modules/search/queries";

export const alt =
  "100Casas.mx — No listamos todo, solo lo que vale la pena. Las 100 mejores oportunidades de tu ciudad, listadas a la vez.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const IMAGE_FETCH_TIMEOUT_MS = 8_000;

const FONT_DIR = join(process.cwd(), "src/app/assets/fonts");

const FONT_CANDIDATES = [
  { file: "PlusJakartaSans-Bold.ttf", name: "PlusJakartaSans", weight: 700, style: "normal" },
  { file: "InstrumentSerif-Italic.ttf", name: "InstrumentSerif", weight: 400, style: "italic" },
  { file: "InstrumentSerif-Regular.ttf", name: "InstrumentSerif", weight: 400, style: "normal" },
] as const;

async function loadFonts() {
  const fonts = [];
  for (const candidate of FONT_CANDIDATES) {
    try {
      const data = await readFile(join(FONT_DIR, candidate.file));
      fonts.push({
        name: candidate.name,
        data,
        weight: candidate.weight,
        style: candidate.style,
      });
    } catch {
      // Fall back to whatever other fonts loaded (or system defaults).
    }
  }
  return fonts;
}

function BrandMark({ size: markSize }: { size: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={markSize}
      height={markSize}
      style={{ borderRadius: 14 }}
    >
      <defs>
        <linearGradient id="og-copper" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D67E3C" />
          <stop offset="100%" stopColor="#A83810" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#og-copper)" />
      <g
        transform="translate(12 12) scale(1.667)"
        fill="none"
        stroke="#FFF7F0"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 12h4" />
        <path d="M10 8h4" />
        <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
        <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
        <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      </g>
    </svg>
  );
}

function formatPrice(price: number, currency: string): string {
  try {
    const symbol = currency === "USD" ? "US$" : "$";
    return `${symbol}${Math.round(price).toLocaleString("es-MX")}`;
  } catch {
    return `$${Math.round(price).toLocaleString("es-MX")}`;
  }
}

function formatLocation(row: {
  colonia: string;
  city: string;
  state: string;
}): string {
  const parts = [row.colonia, row.city, row.state].filter(Boolean);
  return parts.join(", ");
}

/** Fetch a remote image and inline it as a base64 data URL (safe for Satori). */
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const mime = response.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

type ListingCard = {
  image: string | null;
  price: string;
  location: string;
  hotScore: number | null;
  lat: number | null;
  lng: number | null;
};

/**
 * Social-card listings, pinned in display order. Each photo was verified by
 * hand: real listing, no watermark. All are active casas in Chihuahua city,
 * priced ≤ $3,500,000 (the cleanest departamento under that cap in Chihuahua
 * is watermarked, so the cards are all casas). If one goes inactive, its slot
 * falls back to the next cheapest clean non-blocked casa/departamento in
 * Chihuahua.
 */
const CURATED_LISTING_IDS = [
  "aeca72fa-f377-4f60-8400-1f3e560ad82f", // $1,750,000 · Chihuahua
  "d7786920-3375-4c61-80e0-de9a1997ebd5", // $1,950,000 · Villa del Real
  "ac2524bd-ac84-4f26-bf0a-5a0e7396ffda", // $2,600,000 · Los Girasoles III
  "e39f3d14-67bc-4232-8933-03dac5868593", // $3,380,000 · Chihuahua
];

/**
 * Display-only hot scores for the share image. The cards are chosen to fit
 * the social graphic (city, price cap, clean photo), not the live site's hot
 * ranking — so the image always shows these as hot, regardless of the score
 * computed on the site.
 */
const DISPLAY_HOT_SCORE = new Map<string, number>([
  ["aeca72fa-f377-4f60-8400-1f3e560ad82f", 98],
  ["d7786920-3375-4c61-80e0-de9a1997ebd5", 96],
  ["ac2524bd-ac84-4f26-bf0a-5a0e7396ffda", 97],
  ["e39f3d14-67bc-4232-8933-03dac5868593", 95],
]);

/** Photos with visible watermarks or agency branding — never shown.
 * Covers every active casa/departamento listing whose first photo carried
 * legible text when OCR-scanned. */
const BLOCKED_LISTING_IDS = new Set([
  // "Mitlich" watermarks
  "1504f5ca-788b-4961-bba8-6e319626a9e4",
  "714fb213-135d-4378-a413-d988ff82cec9",
  // $3,800,000 · removed by request
  "b970e1a0-42ae-4713-865e-4ed79affb8fd",
  // scattered agency branding / signs
  "0835223c-722f-4d40-ae9f-4525bbf6da89",
  "55798a48-5cb0-451c-9298-84792f00a87e",
  // OCR-verified watermarked casa/departamento photos
  "9dc216d5-6158-4222-afd5-c2f56b9502a3",
  "be48288c-3b7d-4cad-98bc-c3801d569cbb",
  "0f759511-e007-461e-9655-a371006b4931",
  "7e5bed75-46d7-482f-9c3a-0774b1547db4",
  "25aa4899-8963-4b88-b26f-fcc04ee6c2b1",
  "951911dc-f358-492e-a3bf-fc7403539fac",
  "0b9914c4-0afd-463f-aab8-b8b0daedced9",
  "1ceac0f8-113e-48c9-8f2d-d607ef96c267",
  "5ace2f44-8c30-41a6-85d0-3337b9deea19",
  "6f591519-38d8-4e5e-8b91-26f2d61dd8d5",
  "2996d289-e722-4dcf-8cbd-4421c7ad5757",
  "3f2d44c4-c8fe-4734-9b84-7fecf4c31199",
  "d2e780ba-37f0-4a52-ac91-8951ae1b7d1b",
  "59387f86-43f4-46e3-a049-90b43b351aa2",
  "375cd60e-3010-4077-a552-57403f71fc28",
  "366b6300-9080-43da-9e1d-76d0ee6b0bd9",
  "d9fec971-b340-4f32-b848-dec541155851",
  "795c7d0b-dc90-4594-abac-792d2f846bfa",
  "b13da5cc-8b5e-4d29-8be4-1ee22ce2fe24",
  "68c8b3ab-5471-4755-bd17-0f78067857dc",
  "f2b6e168-e591-459d-a45e-65a44b4c06b5",
  "bc068072-25b0-4eab-84e0-12254950cd32",
  "b84a70e9-f913-438c-869b-2950ed455857",
  "fb47c0f4-930a-4cfa-9df0-20e1893b1ca3",
  "258eddc0-7efe-4f6d-8e00-901d225f7aa0",
  "13b64be4-56e8-41ca-a1b8-fe9ef02237f2",
  "2e86eaa1-426c-45a9-86f4-516351ecec7e",
  "748bbb8b-004a-42b9-9ceb-c4498f23bf36",
  "091ce303-1393-4204-8dd9-83ed379f8af1",
  "6d7c7a92-e814-463f-8a0f-a5e246157759",
  "d665a648-7d0d-4210-aa8e-a4b41db566c7",
  "f0535f15-dca8-484d-8838-2f587de9cd29",
  "7042c05a-0092-4b85-9119-5b6228d9cb8b",
  "94f50f19-5362-4f02-b3b3-f1a68a6eff4b",
  "dabbe64e-27a7-4cb6-a475-f075fe0c7ec1",
  "606e27c2-c68a-4db6-8c83-355e8291b0fe",
  "c60b9b7b-c003-477f-bee1-ec595b6a0e13",
  "7bc390ba-5df6-4c2c-9895-991983dd69d9",
  "937a7cd5-c14e-41c4-882b-1b8d446bf749",
  "c117fcfe-12bb-403c-8d99-4c4943fddc6f",
  "5e48c729-e2b0-4dab-afd9-9d624d3481ed",
  "40ff402e-9238-4faa-990c-c161c9aa43b5",
]);

async function loadListingCards(limit = 4): Promise<ListingCard[]> {
  try {
    // Social-graphic pool: casas/departamentos in Chihuahua city priced at or
    // under $3,500,000. Hot scores shown on the card come from
    // DISPLAY_HOT_SCORE, not the live ranking (see above).
    const pool = await searchListingsWithHot({
      categories: ["casa", "departamento"],
      city: "Chihuahua",
      maxPrice: 3_500_000,
      sortBy: "hot",
      limit: HOT_FETCH_CAP,
    });
    const byId = new Map(pool.map((row) => [row.id, row]));

    const rows: ListingWithHot[] = [];
    const used = new Set<string>();
    for (const id of CURATED_LISTING_IDS) {
      const row = byId.get(id);
      if (row) {
        rows.push(row);
        used.add(row.id);
      }
    }

    // Fill any slot left by an inactive pinned listing with the next cheapest
    // clean (non-blocked, image-bearing) Chihuahua casa/departamento.
    if (rows.length < limit) {
      for (const row of pool) {
        if (rows.length >= limit) break;
        if (used.has(row.id) || BLOCKED_LISTING_IDS.has(row.id)) continue;
        if (!Array.isArray(row.images) || row.images.length === 0) continue;
        rows.push(row);
        used.add(row.id);
      }
    }

    const cards = await Promise.all(
      rows.slice(0, limit).map(async (row) => {
        const image =
          row.images && row.images.length > 0
            ? await toDataUrl(row.images[0] ?? "")
            : null;
        return {
          image,
          price: formatPrice(row.price, row.currency),
          location: formatLocation(row),
          // The image always shows these as hot, even if the site score differs.
          hotScore: DISPLAY_HOT_SCORE.get(row.id) ?? row.hotScore,
          lat: row.lat ?? null,
          lng: row.lng ?? null,
        };
      }),
    );
    return cards;
  } catch {
    return [];
  }
}

const MAP_WIDTH = 620;
const MAP_HEIGHT = 320;

function hotnessLabel(score: number): string {
  if (score >= 70) return "Hot";
  if (score >= 40) return "Media";
  return "Fría";
}

function buildStaticMapUrl(cards: ListingCard[]): string | null {
  const withCoords = cards.filter(
    (card) =>
      card.lat != null && card.lng != null && Number.isFinite(card.lat) && Number.isFinite(card.lng),
  );
  if (withCoords.length === 0) return null;

  const key =
    process.env.GOOGLE_MAPS_SERVER_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
    null;
  if (!key) return null;

  const lats = withCoords.map((card) => card.lat as number);
  const lngs = withCoords.map((card) => card.lng as number);
  const north = Math.max(...lats);
  const south = Math.min(...lats);
  const east = Math.max(...lngs);
  const west = Math.min(...lngs);

  const centerLat = (north + south) / 2;
  const centerLng = (east + west) / 2;

  // Zoom so every marker fits on the MAP_WIDTH×MAP_HEIGHT tile. A fixed zoom
  // would push pins off-screen when listings span two cities (~3° apart).
  const PAD = 1.2; // keep marker headroom inside the tile edges
  const lngFraction = (((east - west) || 0) / 360) * PAD;
  const latFraction =
    ((mercatorLat(north) - mercatorLat(south)) / Math.PI) * PAD;
  const latZoom = Math.log2((MAP_HEIGHT / 256) / (latFraction || 1));
  const lngZoom = Math.log2((MAP_WIDTH / 256) / (lngFraction || 1));
  const zoom = Math.max(4, Math.min(16, Math.floor(Math.min(latZoom, lngZoom))));

  const params = new URLSearchParams();
  params.set("center", `${centerLat.toFixed(6)},${centerLng.toFixed(6)}`);
  params.set("zoom", String(zoom));
  params.set("size", `${MAP_WIDTH}x${MAP_HEIGHT}`);
  params.set("maptype", "roadmap");
  for (const card of withCoords.slice(0, 4)) {
    params.append(
      "markers",
      `color:0xA83810|size:mid|${card.lat?.toFixed(6)},${card.lng?.toFixed(6)}`,
    );
  }
  params.set("key", key);
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/** Web Mercator y-position (in world units) for a latitude in degrees. */
function mercatorLat(lat: number): number {
  const rad = (Math.min(85, Math.max(-85, lat)) * Math.PI) / 180;
  return Math.log(Math.tan(rad) + 1 / Math.cos(rad));
}

async function loadMapImage(cards: ListingCard[]): Promise<string | null> {
  const url = buildStaticMapUrl(cards);
  if (!url) return null;
  return toDataUrl(url);
}

function HotBarMini({ score }: { score: number | null }) {
  const clamped = score == null ? null : Math.min(100, Math.max(0, score));
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          position: "relative",
          height: 6,
          borderRadius: 9999,
          background:
            "linear-gradient(to right, #3B82F6 0%, #FACC15 50%, #EF4444 100%)",
        }}
      >
        {clamped != null && (
          <div
            style={{
              position: "absolute",
              top: -2,
              left: `${clamped}%`,
              width: 10,
              height: 10,
              borderRadius: 9999,
              backgroundColor: "#FFF7F0",
              boxShadow: "0 1px 3px rgba(24,15,8,0.5)",
            }}
          />
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 10,
          color: "#6B5446",
        }}
      >
        <span>Fría</span>
        <span style={{ fontWeight: 700, color: "#24160D" }}>
          {clamped != null ? `${clamped}/100 · ${hotnessLabel(clamped)}` : "Sin dato"}
        </span>
        <span>Hot</span>
      </div>
    </div>
  );
}

function ListingCardMini({ card }: { card: ListingCard | null }) {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        gap: 12,
        alignItems: "stretch",
        backgroundColor: "#FFFDF9",
        borderRadius: 16,
        border: "1px solid rgba(36,22,13,0.08)",
        padding: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 96,
          height: 96,
          flexShrink: 0,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: "#EADFD3",
        }}
      >
        {card?.image ? (
          <img
            src={card.image}
            width={96}
            height={96}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              width: "100%",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#D67E3C",
              color: "#FFF7F0",
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            100
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "space-between",
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div
            style={{
              display: "flex",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "#24160D",
            }}
          >
            {card ? card.price : "—"}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 12,
              color: "#6B5446",
              lineHeight: 1.3,
            }}
          >
            {card ? card.location : ""}
          </div>
        </div>
        <HotBarMini score={card?.hotScore ?? null} />
      </div>
    </div>
  );
}

function MapPanel({ cards, mapImage }: { cards: ListingCard[]; mapImage: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        borderRadius: 20,
        overflow: "hidden",
        flex: 1,
        minHeight: 0,
        backgroundColor: "#E8DED1",
        border: "1px solid rgba(36,22,13,0.1)",
      }}
    >
      {mapImage ? (
        <img
          src={mapImage}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            color: "#6B5446",
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          100Casas.mx — mapa de oportunidades
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          position: "absolute",
          top: 14,
          left: 14,
          backgroundColor: "rgba(255,253,249,0.94)",
          borderRadius: 9999,
          padding: "8px 14px",
          fontSize: 14,
          fontWeight: 700,
          color: "#24160D",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 10,
            height: 10,
            borderRadius: 9999,
            backgroundColor: "#A83810",
          }}
        />
        100Casas.mx · Mapa
      </div>
    </div>
  );
}

export default async function BrandSocialImage() {
  const fonts = await loadFonts();
  const cards = await loadListingCards(4);
  const mapImage = await loadMapImage(cards);
  // Normalize to exactly 4 cells (placeholders fill the gaps).
  const cells: (ListingCard | null)[] = [...cards];
  while (cells.length < 4) cells.push(null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#FBF6F0",
          fontFamily: "PlusJakartaSans",
          color: "#24160D",
        }}
      >
        {/* Left panel: brand copy */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 560,
            padding: "56px 48px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative copper glow */}
          <div
            style={{
              position: "absolute",
              left: -160,
              top: -170,
              width: 460,
              height: 460,
              borderRadius: 9999,
              backgroundColor: "rgba(214,126,60,0.18)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -40,
              bottom: -140,
              width: 280,
              height: 280,
              borderRadius: 9999,
              backgroundColor: "rgba(168,56,16,0.12)",
            }}
          />

          {/* Header: mark + wordmark */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              position: "relative",
            }}
          >
            <BrandMark size={48} />
            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              100Casas.mx
            </div>
          </div>

          {/* Headline */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              position: "relative",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#A83810",
              }}
            >
              No listamos todo
            </div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1.04,
              }}
            >
              Solo lo que
            </div>
            <div
              style={{
                fontSize: 64,
                fontFamily: "InstrumentSerif",
                fontStyle: "italic",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                color: "#A83810",
              }}
            >
              vale la pena.
            </div>
            <div
              style={{
                fontSize: 19,
                color: "#6B5446",
                lineHeight: 1.5,
                marginTop: 6,
              }}
            >
              Las 100 mejores oportunidades de tu ciudad, listadas a la vez.
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              position: "relative",
            }}
          >
            <div
              style={{
                width: 42,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#D67E3C",
              }}
            />
            <div style={{ fontSize: 17, color: "#6B5446" }}>
              100Casas.mx — solo lo que vale la pena
            </div>
          </div>
        </div>

        {/* Right panel: map + compact listing cards */}
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            gap: 14,
            padding: 18,
          }}
        >
          <MapPanel cards={cells.filter(Boolean) as ListingCard[]} mapImage={mapImage} />
          <div style={{ display: "flex", gap: 12 }}>
            <ListingCardMini card={cells[0] ?? null} />
            <ListingCardMini card={cells[1] ?? null} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <ListingCardMini card={cells[2] ?? null} />
            <ListingCardMini card={cells[3] ?? null} />
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    },
  );
}
