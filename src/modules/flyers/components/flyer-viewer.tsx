"use client";

import { useEffect, useRef, useState } from "react";

import { captureFlyerLead, recordFlyerAnalytics } from "@/modules/flyers/actions";
import { Button } from "@/components/ui/button";
import type { DigitalFlyersRow, PropertiesRow } from "@/modules/lib/database.types";

type Props = {
  flyer: DigitalFlyersRow;
  property: PropertiesRow;
};

/**
 * Public, shareable digital flyer. Tracks opens + engagement and captures
 * leads without requiring an account.
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
  const recordedRef = useRef(false);

  useEffect(() => {
    if (recordedRef.current) return;
    recordedRef.current = true;

    const record = () => {
      const seconds = Math.min(86_400, Math.round((Date.now() - openedAt) / 1000));
      void recordFlyerAnalytics({
        flyerId: flyer.id,
        visitorSessionId: sessionId,
        timeSpentSeconds: seconds,
        sectionsViewed: { photos: 1, piti_calc: 0, neighborhood: 0 },
      });
    };

    const timer = window.setTimeout(record, 8_000);
    return () => window.clearTimeout(timer);
  }, [flyer.id, openedAt, sessionId]);

  const submitLead = async () => {
    if (!email.trim() && !phone.trim()) {
      setLeadError("Enter an email or phone so the agent can reply.");
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

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="overflow-hidden rounded-xl border bg-card">
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

        <div className="space-y-4 p-6">
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

          {property.description && (
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {property.description}
            </p>
          )}

          {leadState === "saved" ? (
            <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
              Gracias — the agent will contact you shortly.
            </p>
          ) : (
            <div className="rounded-md border p-3">
              <p className="text-sm font-medium">
                Interested? Leave your details
              </p>
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
                  Send
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
