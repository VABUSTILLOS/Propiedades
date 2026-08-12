"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarCheck, Compass } from "lucide-react";

import { captureFlyerLead } from "@/modules/flyers/actions";
import { PitiCalculator } from "@/modules/flyers/components/piti-calculator";
import { PannellumViewer } from "@/modules/flyers/components/pannellum-viewer";
import { POIMap } from "@/modules/maps/components/poi-map";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DigitalFlyersRow, PropertiesRow } from "@/modules/lib/database.types";

type Props = {
  flyer: DigitalFlyersRow;
  property: PropertiesRow;
};

const SECTION_ORDER = [
  { id: "fotos", label: "Fotos" },
  { id: "descripcion", label: "Descripción" },
  { id: "finanzas", label: "Finanzas" },
  { id: "zona", label: "Zona" },
  { id: "agendar", label: "Agendar" },
] as const;

/**
 * Public, shareable digital flyer. Tracks opens + per-section engagement via
 * the `/api/analytics/track` beacon and captures leads without an account.
 */
export function FlyerViewer({ flyer, property }: Props) {
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
  );
  const [openedAt] = useState(() => Date.now());
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [leadState, setLeadState] = useState<"idle" | "saving" | "saved">("idle");
  const [leadError, setLeadError] = useState<string | null>(null);
  const [sectionsSeen, setSectionsSeen] = useState<Record<string, number>>({});
  const recordedRef = useRef(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // IntersectionObserver marks each section as viewed once scrolled into view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.section;
          if (!id) continue;
          setSectionsSeen((prev) =>
            prev[id] ? prev : { ...prev, [id]: 1 },
          );
        }
      },
      { threshold: 0.4 },
    );

    for (const section of SECTION_ORDER) {
      const el = sectionRefs.current[section.id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const sendBeacon = useCallback(
    (finalSections: Record<string, number>, force: boolean) => {
      if (recordedRef.current && !force) return;
      recordedRef.current = true;

      const seconds = Math.min(86_400, Math.round((Date.now() - openedAt) / 1000));
      void fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flyerId: flyer.id,
          visitorSessionId: sessionId,
          timeSpentSeconds: seconds,
          sectionsViewed: finalSections,
        }),
      }).catch(() => {
        // Beacon is best-effort; no user-visible failure.
      });
    },
    [flyer.id, openedAt, sessionId],
  );

  // Initial beacon shortly after load, plus a final one on unmount.
  useEffect(() => {
    const timer = window.setTimeout(() => sendBeacon(sectionsSeen, false), 6_000);
    return () => {
      window.clearTimeout(timer);
      sendBeacon(sectionsSeen, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendBeacon]);

  const scrollToSection = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitLead = async () => {
    if (!email.trim() && !phone.trim()) {
      setLeadError("Escribe un correo o teléfono para que el agente pueda responder.");
      return;
    }
    setLeadState("saving");
    setLeadError(null);
    const res = await captureFlyerLead({
      flyerId: flyer.id,
      visitorSessionId: sessionId,
      email: email.trim() || null,
      phone: phone.trim() || null,
    });
    setLeadState(res.ok ? "saved" : "idle");
    if (!res.ok) setLeadError(res.error);
  };

  const has360 = Boolean(property.tour_360_url);

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Sticky section nav (mobile-first) */}
      <div className="sticky top-0 z-10 mb-4 -mx-4 flex gap-2 overflow-x-auto border-b bg-background/95 px-4 py-2 backdrop-blur">
        {SECTION_ORDER.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollToSection(s.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              sectionsSeen[s.id]
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <section
          ref={(el) => {
            sectionRefs.current.fotos = el;
          }}
          data-section="fotos"
          className="scroll-mt-16"
        >
          {property.images && property.images.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={property.images[0]}
              alt={property.title}
              className="aspect-[16/10] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[16/10] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
              No photos
            </div>
          )}
        </section>

        <div className="space-y-6 p-6">
          <section
            ref={(el) => {
              sectionRefs.current.descripcion = el;
            }}
            data-section="descripcion"
            className="scroll-mt-16 space-y-4"
          >
            <div>
              <h1 className="text-2xl font-bold">
                {flyer.custom_title ?? property.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {property.address}, {property.colonia}, {property.city}
              </p>
            </div>

            <p className="text-3xl font-bold">
              ${property.price.toLocaleString()}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {property.currency}
              </span>
            </p>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border p-3">
                <dt className="text-muted-foreground">Terreno</dt>
                <dd className="font-semibold">{property.terreno_m2} m²</dd>
              </div>
              <div className="rounded-md border p-3">
                <dt className="text-muted-foreground">Construcción</dt>
                <dd className="font-semibold">{property.construccion_m2} m²</dd>
              </div>
            </dl>

            {property.recamaras != null && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{property.recamaras} recámaras</Badge>
                {property.banos != null && (
                  <Badge variant="secondary">{property.banos} baños</Badge>
                )}
              </div>
            )}

            {property.description && (
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {property.description}
              </p>
            )}
          </section>

          {has360 && (
            <div data-section="fotos" className="scroll-mt-16">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Compass className="size-4 text-muted-foreground" />
                Vista 360°
              </div>
              <PannellumViewer url={property.tour_360_url ?? ""} title={property.title} />
            </div>
          )}

          <section
            ref={(el) => {
              sectionRefs.current.finanzas = el;
            }}
            data-section="finanzas"
            className="scroll-mt-16 rounded-lg border p-4"
          >
            <h2 className="mb-3 font-semibold">Calculadora de pago</h2>
            <PitiCalculator
              price={property.price}
              currency={property.currency}
              hoaFee={property.hoa_fee}
              predialAnual={property.predial_anual}
            />
          </section>

          {property.lat != null && property.lng != null ? (
            <section
              ref={(el) => {
                sectionRefs.current.zona = el;
              }}
              data-section="zona"
              className="scroll-mt-16"
            >
              <h2 className="mb-2 font-semibold">La zona</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Escuelas y transporte público cercanos.
              </p>
              <POIMap
                lat={property.lat}
                lng={property.lng}
                className="h-72"
              />
            </section>
          ) : null}

          <section
            ref={(el) => {
              sectionRefs.current.agendar = el;
            }}
            data-section="agendar"
            className="scroll-mt-16 rounded-lg border p-4"
          >
            <div className="flex items-center gap-2">
              <CalendarCheck className="size-4 text-muted-foreground" />
              <h2 className="font-semibold">¿Listo para conocerla?</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Deja tus datos y el agente te contacta para agendar la visita.
            </p>

            {leadState === "saved" ? (
              <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
                Gracias — the agent will contact you shortly.
              </p>
            ) : (
              <div className="mt-3 rounded-md border p-3">
                {leadError && (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {leadError}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-40 rounded-md border bg-background px-2 py-1 text-sm"
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-40 rounded-md border bg-background px-2 py-1 text-sm"
                  />
                  <Button
                    size="sm"
                    disabled={leadState === "saving"}
                    onClick={() => void submitLead()}
                  >
                    Agendar visita
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

