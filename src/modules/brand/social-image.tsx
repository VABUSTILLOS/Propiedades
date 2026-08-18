import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const alt =
  "100Casas.mx — No listamos todo, solo lo que vale la pena. Las 100 mejores oportunidades de tu ciudad, listadas a la vez.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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

export default async function BrandSocialImage() {
  const fonts = await loadFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          backgroundColor: "#FBF6F0",
          fontFamily: "PlusJakartaSans",
          color: "#24160D",
        }}
      >
        {/* Decorative copper glow */}
        <div
          style={{
            position: "absolute",
            right: -140,
            top: -170,
            width: 520,
            height: 520,
            borderRadius: 9999,
            backgroundColor: "rgba(214,126,60,0.18)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 140,
            bottom: -130,
            width: 300,
            height: 300,
            borderRadius: 9999,
            backgroundColor: "rgba(168,56,16,0.12)",
          }}
        />

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "72px 88px",
            position: "relative",
          }}
        >
          {/* Header: mark + wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <BrandMark size={52} />
            <div
              style={{
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              100Casas.mx
            </div>
          </div>

          {/* Headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                color: "#A83810",
              }}
            >
              No listamos todo
            </div>
            <div
              style={{
                fontSize: 84,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1.04,
              }}
            >
              Solo lo que
            </div>
            <div
              style={{
                fontSize: 84,
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
                fontSize: 26,
                color: "#6B5446",
                lineHeight: 1.45,
                maxWidth: 940,
              }}
            >
              Por eso, aquí solo encuentras las 100 mejores oportunidades, listadas a la vez, para que descubras la mejor casa para ti de tu ciudad.
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#D67E3C",
              }}
            />
            <div style={{ fontSize: 20, color: "#6B5446" }}>
              100Casas.mx — las 100 mejores oportunidades de tu ciudad
            </div>
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
