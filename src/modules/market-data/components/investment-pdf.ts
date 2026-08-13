import { jsPDF } from "jspdf";

import type {
  MarketBenchmarksRow,
  PropertiesRow,
} from "@/modules/lib/database.types";
import { buildWhatsAppInquiryLink } from "@/modules/chat/share";
import {
  calcularPosibleRenta,
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
  // Pre-load every property photo (if any) before building the document so
  // they can be embedded synchronously. External images may be CORS-blocked:
  // tolerate it — a failed photo is skipped silently.
  const imageDataUrls = await Promise.all(
    (property.images ?? []).map((src) => loadImageDataUrl(src)),
  );

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 0;

  drawHeader(doc, property, imageDataUrls[0]?.dataUrl ?? null);
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
    formatMxn(estimateMantenimiento(calcularPosibleRenta(property))),
    "1.5× de la renta mensual estimada",
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

  const photos = imageDataUrls.filter(
    (image): image is { dataUrl: string; width: number; height: number } =>
      image !== null,
  );
  if (photos.length > 0) {
    y = drawPhotosSection(doc, y, photos);
  }

  y = drawWhatsAppCta(doc, y, property);

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
/* Photos + WhatsApp CTA                                               */
/* ------------------------------------------------------------------ */

const WHATSAPP_GREEN: [number, number, number] = [10, 96, 53]; // #0A6035

/**
 * Convert one SVG elliptical arc segment into cubic Bézier curves
 * (endpoint → center parametrization), relative to the current point.
 */
function arcToCubics(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  phi: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
): number[][] {
  const curves: number[][] = [];
  // Per SVG spec: if radii are 0, it's a straight line.
  if (rx === 0 || ry === 0) {
    curves.push([x2, y2]);
    return curves;
  }
  // (F.6.5.1) Ensure radii are positive.
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phiRad = (phi * Math.PI) / 180;
  const cosPhi = Math.cos(phiRad);
  const sinPhi = Math.sin(phiRad);
  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  // (F.6.5.2) Transform to the "primed" coordinate space.
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;
  // (F.6.6.2) Correct radii if out of range.
  const lambda =
    (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }
  // (F.6.5.3) Compute center in primed space.
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const num =
    rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p;
  const den = rx2 * y1p * y1p + ry2 * x1p * x1p;
  const radicand = num / den;
  const coef = Math.sqrt(Math.max(0, radicand)) *
    (largeArc === sweep ? -1 : 1);
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (coef * -ry * x1p) / rx;
  // Transform center back to the original space.
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;
  // (F.6.5.5) Compute start and sweep angles.
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    let a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const vx = (x1p - cxp) / rx;
  const vy = (y1p - cyp) / ry;
  const ux = (-x1p - cxp) / rx;
  const uy = (-y1p - cyp) / ry;
  const theta1 = angle(1, 0, vx, vy);
  let deltaTheta = angle(vx, vy, ux, uy);
  if (!sweep && deltaTheta > 0) deltaTheta -= 2 * Math.PI;
  if (sweep && deltaTheta < 0) deltaTheta += 2 * Math.PI;
  // Split into segments no larger than ~90° (matches common renderers).
  const segments = Math.max(1, Math.ceil(Math.abs(deltaTheta) / (Math.PI / 2)));
  const dTheta = deltaTheta / segments;
  const t = (4 / 3) * Math.tan(dTheta / 4);
  let theta = theta1;
  for (let i = 0; i < segments; i++) {
    const cos1 = Math.cos(theta);
    const sin1 = Math.sin(theta);
    const theta2 = theta + dTheta;
    const cos2 = Math.cos(theta2);
    const sin2 = Math.sin(theta2);
    const cp1x =
      cx + rx * cos1 * cosPhi - ry * sin1 * sinPhi + (-rx * sin1 * cosPhi - ry * cos1 * sinPhi) * t;
    const cp1y =
      cy + rx * cos1 * sinPhi + ry * sin1 * cosPhi + (-rx * sin1 * sinPhi + ry * cos1 * cosPhi) * t;
    const cp2x =
      cx + rx * cos2 * cosPhi - ry * sin2 * sinPhi + (rx * sin2 * cosPhi + ry * cos2 * sinPhi) * t;
    const cp2y =
      cy + rx * cos2 * sinPhi + ry * sin2 * cosPhi + (rx * sin2 * sinPhi - ry * cos2 * cosPhi) * t;
    const endX = cx + rx * cos2 * cosPhi - ry * sin2 * sinPhi;
    const endY = cy + rx * cos2 * sinPhi + ry * sin2 * cosPhi;
    curves.push([cp1x, cp1y, cp2x, cp2y, endX, endY]);
    theta = theta2;
  }
  return curves;
}

/**
 * Parse an SVG path string (subset: M/m, L/l, H/h, V/v, C/c, A/a, Z/z)
 * into the `{ op, c }` array format jsPDF's `doc.path` expects.
 * All output coordinates are absolute in the path's own user space.
 */
function parseSvgPath(
  pathData: string,
): { op: "m" | "l" | "c" | "h"; c: number[] }[] {
  const commands: { op: "m" | "l" | "c" | "h"; c: number[] }[] = [];
  let i = 0;
  let current = "";
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;

  const isDigit = (ch: string) => /[0-9]/.test(ch);

  const skipSep = () => {
    while (i < pathData.length && /[\s,]/.test(pathData[i] ?? "")) i++;
  };

  const readNumber = (): number => {
    skipSep();
    const start = i;
    // Optional sign.
    if (pathData[i] === "+" || pathData[i] === "-") i++;
    // Integer part, optional decimal part, optional exponent.
    while (i < pathData.length && isDigit(pathData[i] ?? "")) i++;
    if (pathData[i] === ".") {
      i++;
      while (i < pathData.length && isDigit(pathData[i] ?? "")) i++;
    }
    if (pathData[i] === "e" || pathData[i] === "E") {
      i++;
      if (pathData[i] === "+" || pathData[i] === "-") i++;
      while (i < pathData.length && isDigit(pathData[i] ?? "")) i++;
    }
    const num = parseFloat(pathData.slice(start, i));
    return Number.isFinite(num) ? num : 0;
  };

  // Read a single SVG arc flag ("0" or "1"). SVG allows the two flags to be
  // written concatenated ("01"), so they must be consumed one character at a
  // time — never via the general number tokenizer.
  const readFlag = (): boolean => {
    skipSep();
    const ch = pathData[i] ?? "";
    i++;
    return ch === "1";
  };

  while (i < pathData.length) {
    skipSep();
    const ch = pathData[i] ?? "";
    if (/[a-zA-Z]/.test(ch)) {
      current = ch;
      i++;
    }
    const cmd = current.toUpperCase();
    const isRel = current === current.toLowerCase() && cmd !== "Z";
    switch (cmd) {
      case "M": {
        let x = readNumber();
        let y = readNumber();
        if (isRel) {
          x += cx;
          y += cy;
        }
        cx = x;
        cy = y;
        sx = cx;
        sy = cy;
        commands.push({ op: "m", c: [cx, cy] });
        // Implicit lineto after moveto.
        current = isRel ? "l" : "L";
        break;
      }
      case "L": {
        let x = readNumber();
        let y = readNumber();
        if (isRel) {
          x += cx;
          y += cy;
        }
        cx = x;
        cy = y;
        commands.push({ op: "l", c: [cx, cy] });
        break;
      }
      case "H": {
        let x = readNumber();
        if (isRel) x += cx;
        cx = x;
        commands.push({ op: "l", c: [cx, cy] });
        break;
      }
      case "V": {
        let y = readNumber();
        if (isRel) y += cy;
        cy = y;
        commands.push({ op: "l", c: [cx, cy] });
        break;
      }
      case "C": {
        const p = Array.from({ length: 6 }, () => readNumber());
        let x1 = p[0] ?? 0;
        let y1 = p[1] ?? 0;
        let x2 = p[2] ?? 0;
        let y2 = p[3] ?? 0;
        let x3 = p[4] ?? 0;
        let y3 = p[5] ?? 0;
        if (isRel) {
          x1 += cx;
          y1 += cy;
          x2 += cx;
          y2 += cy;
          x3 += cx;
          y3 += cy;
        }
        commands.push({ op: "c", c: [x1, y1, x2, y2, x3, y3] });
        cx = x3;
        cy = y3;
        break;
      }
      case "A": {
        const rx = readNumber();
        const ry = readNumber();
        const rot = readNumber();
        // Arc flags are single characters ("0" or "1") and may be
        // concatenated (e.g. "01" = large-arc=0, sweep=1).
        const large = readFlag();
        const sweep = readFlag();
        let x = readNumber();
        let y = readNumber();
        if (isRel) {
          x += cx;
          y += cy;
        }
        const curves = arcToCubics(cx, cy, rx, ry, rot, large, sweep, x, y);
        for (const curve of curves) {
          if (curve.length === 2) {
            commands.push({ op: "l", c: [curve[0] ?? 0, curve[1] ?? 0] });
          } else {
            commands.push({ op: "c", c: curve });
          }
        }
        cx = x;
        cy = y;
        break;
      }
      case "Z": {
        commands.push({ op: "h", c: [] });
        cx = sx;
        cy = sy;
        break;
      }
      default:
        throw new Error(`Unsupported SVG path command: ${current}`);
    }
  }
  return commands;
}

/** WhatsApp logo path data (viewBox 0 0 24 24), drawn with `doc.path`. */
const WHATSAPP_GLYPH_PATH =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";

function drawPhotosSection(
  doc: jsPDF,
  y: number,
  photos: { dataUrl: string; width: number; height: number }[],
): number {
  y = drawSectionHeader(doc, y, "Fotos de la propiedad");
  const maxImgHeight = 120;

  for (const photo of photos) {
    const aspect = photo.width / Math.max(photo.height, 1);
    let imgW = CONTENT_WIDTH;
    let imgH = imgW / aspect;
    if (imgH > maxImgHeight) {
      imgH = maxImgHeight;
      imgW = imgH * aspect;
    }

    if (y + imgH > PAGE_HEIGHT - 20) {
      doc.addPage();
      y = MARGIN;
    }

    const imgX = MARGIN + (CONTENT_WIDTH - imgW) / 2;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(imgX - 1, y - 1, imgW + 2, imgH + 2, 2, 2, "F");
    doc.addImage(photo.dataUrl, "JPEG", imgX, y, imgW, imgH, undefined, "FAST");
    y += imgH + 8;
  }

  return y;
}

function drawWhatsAppCta(doc: jsPDF, y: number, property: PropertiesRow): number {
  const boxX = MARGIN;
  const boxW = CONTENT_WIDTH;
  const boxH = 20;

  if (y + boxH > PAGE_HEIGHT - 20) {
    doc.addPage();
    y = MARGIN;
  }

  const url = buildWhatsAppInquiryLink(property);

  // Green CTA box.
  doc.setFillColor(WHATSAPP_GREEN[0], WHATSAPP_GREEN[1], WHATSAPP_GREEN[2]);
  doc.roundedRect(boxX, y, boxW, boxH, 4, 4, "F");

  // WhatsApp glyph (white) at left. jsPDF's y-axis points down (same as the
  // SVG viewBox), so we translate each command into the box directly instead
  // of using a transformation matrix (which jsPDF applies after its own
  // y-flip and would place the glyph off-page).
  const logoSize = 9;
  const logoX = boxX + 8;
  const logoY = y + (boxH - logoSize) / 2;
  const scale = logoSize / 24;
  const glyphCommands = parseSvgPath(WHATSAPP_GLYPH_PATH).map((cmd) => {
    if (cmd.op === "h") return { op: "h" as const, c: [] as number[] };
    const c: number[] = [];
    for (let i = 0; i < cmd.c.length; i += 2) {
      c.push(logoX + ((cmd.c[i] ?? 0) - 0.157) * scale);
      c.push(logoY + (cmd.c[i + 1] ?? 0) * scale);
    }
    return { op: cmd.op, c };
  });
  doc.setFillColor(255, 255, 255);
  doc.path(glyphCommands);
  doc.fill();

  // Text.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("Preguntar por esta propiedad", logoX + logoSize + 4, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(
    "Escríbenos por WhatsApp y te respondemos a la brevedad",
    logoX + logoSize + 4,
    y + 15.5,
  );

  // Whole box is clickable.
  doc.link(boxX, y, boxW, boxH, { url });

  return y + boxH + 10;
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

async function loadImageDataUrl(
  src: string | undefined,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!src) return null;
  try {
    return await new Promise<{ dataUrl: string; width: number; height: number }>(
      (resolve, reject) => {
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
            resolve({
              dataUrl: canvas.toDataURL("image/jpeg", 0.8),
              width: img.naturalWidth,
              height: img.naturalHeight,
            });
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = () => reject(new Error("Image failed to load"));
        img.src = src;
      },
    );
  } catch {
    // External images may be blocked by CORS — skip silently.
    return null;
  }
}
