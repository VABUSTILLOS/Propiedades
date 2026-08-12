import { jsPDF } from "jspdf";

import type {
  MarketBenchmarksRow,
  PropertiesRow,
} from "@/modules/lib/database.types";
import {
  estimateEscrituracion,
  estimateMantenimiento,
  estimatePredial,
} from "@/modules/lib/real-estate";

const PAGE_WIDTH = 210; // A4 portrait in mm
const PAGE_HEIGHT = 297;
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK: [number, number, number] = [30, 41, 59]; // slate-800
const MUTED: [number, number, number] = [100, 116, 139]; // slate-500
const ACCENT: [number, number, number] = [13, 148, 136]; // teal-600
const HERO: [number, number, number] = [15, 23, 42]; // slate-900
const HERO_MUTED: [number, number, number] = [148, 163, 184]; // slate-400

export type InvestmentPdfInput = {
  property: PropertiesRow;
  benchmark: MarketBenchmarksRow | null;
  discountPct: number | null;
};

/**
 * Generate a "Ficha de inversión" PDF for a property on the fly and trigger
 * the browser download. Pure client-side (jsPDF), no server round-trip.
 */
export async function generateInvestmentPdf({
  property,
  benchmark,
  discountPct,
}: InvestmentPdfInput): Promise<void> {
  // Pre-load the cover image (if any) before building the document so it can
  // be embedded synchronously. External images may be CORS-blocked: tolerate it.
  const imageDataUrl = await loadImageDataUrl(property.images?.[0]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 0;

  drawHeader(doc, property, imageDataUrl);
  y = HEADER_HEIGHT + 10;

  y = drawSectionHeader(doc, y, "Datos financieros");
  const precioM2Const =
    property.precio_m2_const ??
    (property.construccion_m2 > 0 ? property.price / property.construccion_m2 : 0);
  const precioM2Terreno =
    property.precio_m2_terreno ??
    (property.terreno_m2 > 0 ? property.price / property.terreno_m2 : 0);
  const benchmarkConst =
    benchmark?.avg_price_m2_const != null
      ? Math.round(benchmark.avg_price_m2_const)
      : null;
  const benchmarkLand =
    benchmark?.avg_price_m2_land != null
      ? Math.round(benchmark.avg_price_m2_land)
      : null;

  y = drawRow(doc, y, "Precio de venta", formatAmount(property.price, property.currency));
  y = drawRow(
    doc,
    y,
    "Predial estimado (anual)",
    formatMxn(estimatePredial(property.price)),
  );
  y = drawRow(
    doc,
    y,
    "Mantenimiento anual estimado",
    formatMxn(estimateMantenimiento(property.price)),
    "1% del valor de la propiedad",
  );
  y = drawRow(doc, y, "Escrituración estimada", formatMxn(estimateEscrituracion(property.price)));
  y = drawRow(doc, y, "Precio por m² construido", `$${Math.round(precioM2Const).toLocaleString("es-MX")} / m²`,
    benchmarkConst != null ? `Benchmark colonia: $${benchmarkConst.toLocaleString("es-MX")} / m²` : undefined);
  y = drawRow(doc, y, "Precio por m² de terreno", `$${Math.round(precioM2Terreno).toLocaleString("es-MX")} / m²`,
    benchmarkLand != null ? `Benchmark colonia: $${benchmarkLand.toLocaleString("es-MX")} / m²` : undefined);
  y = drawRow(
    doc,
    y,
    "Descuento vs colonia",
    discountPct == null
      ? "Sin dato"
      : discountPct >= 0
        ? `${discountPct.toFixed(1)}% abajo`
        : `${Math.abs(discountPct).toFixed(1)}% arriba`,
  );
  if (benchmark) {
    y = drawRow(
      doc,
      y,
      "Crecimiento anual de la colonia",
      `${(benchmark.historical_growth_rate ?? 0).toFixed(2)}%`,
    );
  }

  y = drawSectionHeader(doc, y, "Detalles de la propiedad");
  y = drawRow(
    doc,
    y,
    "Tipo de operación",
    property.type === "rent" ? "En renta" : "En venta",
  );
  y = drawRow(doc, y, "Modalidad", dealTypeLabel(property.deal_type));
  y = drawRow(doc, y, "m² terreno", `${property.terreno_m2.toLocaleString("es-MX")} m²`);
  y = drawRow(
    doc,
    y,
    "m² construido",
    `${property.construccion_m2.toLocaleString("es-MX")} m²`,
  );
  if (property.recamaras != null) y = drawRow(doc, y, "Recámaras", String(property.recamaras));
  if (property.banos != null) y = drawRow(doc, y, "Baños", String(property.banos));
  if (property.estacionamientos != null)
    y = drawRow(doc, y, "Estacionamientos", String(property.estacionamientos));
  if (property.antiguedad != null)
    y = drawRow(doc, y, "Antigüedad", `${property.antiguedad} años`);

  if (property.deal_type === "venta_directa") {
    if (property.estimated_monthly_rent != null || property.cap_rate_projected != null) {
      y = drawSectionHeader(doc, y, "Ingresos estimados");
      if (property.estimated_monthly_rent != null)
        y = drawRow(
          doc,
          y,
          "Renta mensual estimada",
          `$${property.estimated_monthly_rent.toLocaleString("es-MX")}/mes`,
        );
      if (property.cap_rate_projected != null)
        y = drawRow(
          doc,
          y,
          "Cap rate proyectado",
          `${(property.cap_rate_projected * 100).toFixed(2)}%`,
        );
    }
  }

  if (property.description) {
    y = drawSectionHeader(doc, y, "Descripción");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    const lines = doc.splitTextToSize(property.description, CONTENT_WIDTH) as string[];
    const lineHeight = 4.8;
    for (const line of lines) {
      if (y > PAGE_HEIGHT - 20) {
        doc.addPage();
        y = MARGIN;
      }
      doc.text(line, MARGIN, y);
      y += lineHeight;
    }
  }

  drawFooter(doc);
  doc.save(`ficha-inversion-${property.slug}.pdf`);
}

/* ------------------------------------------------------------------ */
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */

const HEADER_HEIGHT = 52;

function drawHeader(doc: jsPDF, property: PropertiesRow, imageDataUrl: string | null) {
  doc.setFillColor(HERO[0], HERO[1], HERO[2]);
  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT, "F");

  // Accent bar
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(0, HEADER_HEIGHT - 2.5, PAGE_WIDTH, 2.5, "F");

  doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("FICHA DE INVERSIÓN", MARGIN, 13);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const titleLines = doc.splitTextToSize(property.title, CONTENT_WIDTH - 42) as string[];
  let titleY = 23;
  for (const line of titleLines.slice(0, 2)) {
    doc.text(line, MARGIN, titleY);
    titleY += 6;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(HERO_MUTED[0], HERO_MUTED[1], HERO_MUTED[2]);
  const address = `${property.address} · ${property.colonia}, ${property.city}, ${property.state}`;
  const addressLines = doc.splitTextToSize(address, CONTENT_WIDTH - 42) as string[];
  doc.text(addressLines[0] ?? "", MARGIN, titleY + 2);

  const price = formatAmount(property.price, property.currency);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(price, MARGIN, titleY + 10);

  if (imageDataUrl) {
    const imgW = 30;
    const imgH = 22;
    doc.setFillColor(255, 255, 255);
    doc.rect(PAGE_WIDTH - MARGIN - imgW, 8, imgW, imgH, "F");
    doc.addImage(imageDataUrl, "JPEG", PAGE_WIDTH - MARGIN - imgW, 8, imgW, imgH, undefined, "FAST");
  }
}

function drawSectionHeader(doc: jsPDF, y: number, title: string): number {
  if (y > PAGE_HEIGHT - 40) {
    doc.addPage();
    y = MARGIN;
  }
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(MARGIN, y - 3.5, 3, 4.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(title, MARGIN + 5.5, y);
  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN, y + 3, PAGE_WIDTH - MARGIN, y + 3);
  return y + 10;
}

function drawRow(
  doc: jsPDF,
  y: number,
  label: string,
  value: string,
  hint?: string,
): number {
  if (y > PAGE_HEIGHT - 24) {
    doc.addPage();
    y = MARGIN;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(label, MARGIN, y);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(INK[0], INK[1], INK[2]);
  const valueLines = doc.splitTextToSize(value, CONTENT_WIDTH - 70) as string[];
  if (valueLines.length === 1) {
    doc.text(valueLines[0]!, PAGE_WIDTH - MARGIN, y, { align: "right" });
  } else {
    doc.text(valueLines, PAGE_WIDTH - MARGIN, y, { align: "right" });
  }

  let nextY = y + 5;
  if (hint) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const hintLines = doc.splitTextToSize(hint, CONTENT_WIDTH - 70) as string[];
    doc.text(hintLines, PAGE_WIDTH - MARGIN, nextY, { align: "right" });
    nextY += hintLines.length * 3.6 + 1.5;
  }
  return nextY;
}

function drawFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN, PAGE_HEIGHT - 14, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      `Generado el ${new Date().toLocaleDateString("es-MX")} · Propiedades`,
      MARGIN,
      PAGE_HEIGHT - 9,
    );
    doc.text(`Página ${i} de ${pages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 9, {
      align: "right",
    });
  }
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

function formatAmount(price: number, currency: string): string {
  return `$${price.toLocaleString("es-MX")} ${currency}`;
}

function formatMxn(amount: number): string {
  return `$${amount.toLocaleString("es-MX")}`;
}

function dealTypeLabel(dealType: PropertiesRow["deal_type"]): string {
  switch (dealType) {
    case "remate_bancario":
      return "Remate bancario";
    case "flipping":
      return "Flipping";
    case "traspaso":
      return "Traspaso";
    default:
      return "Venta directa";
  }
}

async function loadImageDataUrl(src: string | undefined): Promise<string | null> {
  if (!src) return null;
  try {
    return await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas 2D context unavailable"));
            return;
          }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error("Image failed to load"));
      img.src = src;
    });
  } catch {
    // External images may be blocked by CORS — skip silently.
    return null;
  }
}
