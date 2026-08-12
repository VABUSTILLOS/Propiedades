"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import type {
  MarketBenchmarksRow,
  PropertiesRow,
} from "@/modules/lib/database.types";
import { Button } from "@/components/ui/button";
import { generateInvestmentPdf } from "@/modules/market-data/components/investment-pdf";

type Props = {
  property: PropertiesRow;
  benchmark: MarketBenchmarksRow | null;
  discountPct: number | null;
  className?: string;
};

/**
 * Button that generates and downloads the "Ficha de inversión" PDF of a
 * property on the fly (client-side, jsPDF).
 */
export function DownloadInvestmentPdfButton({
  property,
  benchmark,
  discountPct,
  className,
}: Props) {
  const [generating, setGenerating] = useState(false);

  async function handleDownload() {
    if (generating) return;
    setGenerating(true);
    try {
      await generateInvestmentPdf({ property, benchmark, discountPct });
    } catch (error) {
      console.error("No se pudo generar el PDF:", error);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={handleDownload}
      disabled={generating}
    >
      {generating ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      {generating ? "Generando…" : "Descargar PDF"}
    </Button>
  );
}
