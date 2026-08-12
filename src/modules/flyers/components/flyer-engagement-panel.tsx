"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

import { sendFlyerWhatsAppAlert } from "@/modules/flyers/actions";
import { Button } from "@/components/ui/button";
import type { Json } from "@/modules/lib/database.types";

export type AnalyticsPoint = {
  id: string;
  time_spent_seconds: number | null;
  sections_viewed: Json;
  engagement_score: number | null;
  lead_email: string | null;
  lead_phone: string | null;
  opened_at: string;
};

type Props = {
  flyerId: string;
  flyerSlug: string;
  analytics: AnalyticsPoint[];
};

const SECTION_LABELS: Record<string, string> = {
  fotos: "Fotos",
  descripcion: "Descripción",
  finanzas: "Finanzas",
  zona: "Zona",
  agendar: "Agendar",
};

/**
 * Engagement heatmap: which sections of the flyer drove the most interest,
 * plus a WhatsApp alert button for high-value prospects.
 */
export function FlyerEngagementPanel({ flyerId, flyerSlug, analytics }: Props) {
  const [alertState, setAlertState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Aggregate section views across all visits (JSONB objects of counters).
  const sectionCounts: Record<string, number> = {};
  for (const point of analytics) {
    if (typeof point.sections_viewed !== "object" || point.sections_viewed === null) {
      continue;
    }
    for (const [key, value] of Object.entries(point.sections_viewed)) {
      if (typeof value === "number") {
        sectionCounts[key] = (sectionCounts[key] ?? 0) + value;
      }
    }
  }
  const maxSectionCount = Math.max(1, ...Object.values(sectionCounts));

  const highIntent = analytics.filter((a) => (a.engagement_score ?? 0) >= 0.7).length;

  const sendAlert = async () => {
    setAlertState("sending");
    setAlertMessage(null);
    const summary = analytics.length > 0
      ? `Nuevo interés en tu flyer ${flyerSlug}: ${analytics.length} visitas, ${highIntent} prospectos con intención alta.`
      : `Tu flyer ${flyerSlug} está recibiendo visitas.`;
    const res = await sendFlyerWhatsAppAlert({ flyerId, message: summary });
    if (res.ok) {
      setAlertState("sent");
      setAlertMessage(
        res.data.sent
          ? "Alerta enviada por WhatsApp."
          : "WhatsApp webhook no configurado — alerta omitida.",
      );
    } else {
      setAlertState("error");
      setAlertMessage(res.error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Mapa de calor por sección</h2>
          <p className="text-sm text-muted-foreground">
            Qué secciones generaron más interés en los visitantes.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={alertState === "sending"}
          onClick={() => void sendAlert()}
        >
          <MessageCircle className="size-4" />
          {alertState === "sending" ? "Enviando…" : "Alertar por WhatsApp"}
        </Button>
      </div>

      {alertMessage && (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {alertMessage}
        </p>
      )}

      {Object.keys(sectionCounts).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay datos de secciones. Comparte el enlace para empezar a
          recopilar mapas de calor.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(sectionCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([key, count]) => {
              const ratio = count / maxSectionCount;
              const opacity = 0.25 + ratio * 0.75;
              return (
                <div
                  key={key}
                  className="rounded-lg border bg-card p-3"
                  style={{
                    backgroundColor: `rgba(34, 197, 94, ${opacity})`,
                  }}
                >
                  <p className="text-sm font-medium">
                    {SECTION_LABELS[key] ?? key}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {count} {count === 1 ? "vista" : "vistas"}
                  </p>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
