"use client";

import { useEffect, useState, useTransition } from "react";
import { BadgePercent, CheckCircle2, Sparkles } from "lucide-react";

import { createDraft, saveWizardStep, setListingStatus } from "@/modules/listings/actions";
import { estimateFsboValue } from "@/modules/fsbo/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlacesAutocomplete } from "@/modules/maps/components/places-autocomplete";

type WizardData = {
  title: string;
  price: string;
  currency: string;
  terreno_m2: string;
  construccion_m2: string;
  address: string;
  colonia: string;
  city: string;
  state: string;
  zip_code: string;
  lat: string;
  lng: string;
  description: string;
  images: string;
};

const initialData: WizardData = {
  title: "",
  price: "",
  currency: "MXN",
  terreno_m2: "",
  construccion_m2: "",
  address: "",
  colonia: "",
  city: "",
  state: "",
  zip_code: "",
  lat: "",
  lng: "",
  description: "",
  images: "",
};

/**
 * FSBO quick-load wizard: one page, AVM auto-valuation shown live, publishes
 * the listing directly on save (no draft step).
 */
export function FsboWizard({ cities }: { cities: string[] }) {
  const [data, setData] = useState<WizardData>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; slug: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [avm, setAvm] = useState<{
    estimate: number;
    low: number;
    high: number;
    hasBenchmark: boolean;
  } | null>(null);

  const update = (key: keyof WizardData, value: string) =>
    setData((prev) => ({ ...prev, [key]: value }));

  // Live AVM: re-estimate as location + m² change.
  useEffect(() => {
    const timer = setTimeout(() => {
      const c = Number(data.construccion_m2) || 0;
      const t = Number(data.terreno_m2) || 0;
      if (!data.city.trim() || !data.colonia.trim() || (c <= 0 && t <= 0)) {
        setAvm(null);
        return;
      }
      void estimateFsboValue({
        city: data.city,
        colonia: data.colonia,
        construccion_m2: c,
        terreno_m2: t,
      }).then((res) => {
        if (res.ok && res.data.estimate > 0) {
          setAvm(res.data);
        } else {
          setAvm(null);
        }
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [data.city, data.colonia, data.construccion_m2, data.terreno_m2]);

  const publish = () =>
    startTransition(async () => {
      setError(null);
      const form = new FormData();
      form.set("title", data.title);
      form.set("type", "sale");
      if (data.description.trim()) form.set("description", data.description.trim());

      const draft = await createDraft(undefined, form);
      if (!draft.ok) {
        setError(draft.error);
        return;
      }
      const id = draft.data.id;

      const steps: Array<[2 | 3 | 4, Record<string, unknown>]> = [
        [
          2,
          {
            price: Number(data.price) || 0,
            currency: data.currency,
            terreno_m2: Number(data.terreno_m2) || 0,
            construccion_m2: Number(data.construccion_m2) || 0,
          },
        ],
        [
          3,
          {
            address: data.address,
            colonia: data.colonia,
            city: data.city,
            state: data.state,
            zip_code: data.zip_code.trim() || undefined,
            lat: Number(data.lat),
            lng: Number(data.lng),
          },
        ],
        [
          4,
          {
            images: data.images
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          },
        ],
      ];

      for (const [step, payload] of steps) {
        const res = await saveWizardStep(id, step, payload);
        if (!res.ok) {
          setError(res.error);
          return;
        }
      }

      const pub = await setListingStatus(id, "active");
      if (!pub.ok) {
        setError(pub.error);
        return;
      }

      setDone({ id, slug: data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") });
    });

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-10 text-center">
        <CheckCircle2 className="size-10 text-emerald-600" />
        <h3 className="text-lg font-semibold">¡Listo!</h3>
        <p className="text-sm text-muted-foreground">
          Tu propiedad quedó publicada y el Bidding Hub ya acepta ofertas.
        </p>
        <a href={`/property/${done.slug}`} className="text-sm text-primary hover:underline">
          Ver tu propiedad
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        publish();
      }}
      className="space-y-5 rounded-lg border bg-card p-6 shadow-sm"
    >
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="fsbo-title">Título</Label>
        <Input
          id="fsbo-title"
          value={data.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="Casa en venta en colonia Centro"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="fsbo-price">Precio (MXN)</Label>
          <Input
            id="fsbo-price"
            type="number"
            min={0}
            value={data.price}
            onChange={(e) => update("price", e.target.value)}
            placeholder="2,500,000"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fsbo-const">Construcción (m²)</Label>
          <Input
            id="fsbo-const"
            type="number"
            min={0}
            value={data.construccion_m2}
            onChange={(e) => update("construccion_m2", e.target.value)}
            placeholder="120"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fsbo-terreno">Terreno (m²)</Label>
          <Input
            id="fsbo-terreno"
            type="number"
            min={0}
            value={data.terreno_m2}
            onChange={(e) => update("terreno_m2", e.target.value)}
            placeholder="200"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fsbo-city">Ciudad</Label>
          <Input
            id="fsbo-city"
            list="fsbo-cities"
            value={data.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder="Monterrey"
            required
          />
          <datalist id="fsbo-cities">
            {cities.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fsbo-colonia">Colonia</Label>
          <Input
            id="fsbo-colonia"
            value={data.colonia}
            onChange={(e) => update("colonia", e.target.value)}
            placeholder="Centro"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fsbo-address">Dirección</Label>
          <Input
            id="fsbo-address"
            value={data.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="Calle, número"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fsbo-state">Estado</Label>
          <Input
            id="fsbo-state"
            value={data.state}
            onChange={(e) => update("state", e.target.value)}
            placeholder="Nuevo León"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fsbo-loc">Ubicación en el mapa</Label>
        <PlacesAutocomplete
          value={data.address}
          onSelect={(result) => {
            if (result.lat != null && result.lng != null) {
              update("lat", String(result.lat));
              update("lng", String(result.lng));
            }
            if (result.formatted_address) {
              update("address", result.formatted_address);
            }
            if (result.city) update("city", result.city);
            if (result.state) update("state", result.state);
            if (result.colonia) update("colonia", result.colonia);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fsbo-imgs">Fotos (URLs separadas por coma)</Label>
        <Input
          id="fsbo-imgs"
          value={data.images}
          onChange={(e) => update("images", e.target.value)}
          placeholder="https://…, https://…"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fsbo-desc">Descripción</Label>
        <Textarea
          id="fsbo-desc"
          value={data.description}
          onChange={(e) => update("description", e.target.value)}
          rows={4}
          placeholder="Cuéntale a los compradores sobre tu casa…"
        />
      </div>

      {avm && (
        <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4">
          <Sparkles className="mt-0.5 size-5 text-primary" />
          <div className="text-sm">
            <p className="font-semibold">Valuación automática (AVM)</p>
            <p className="mt-1 text-muted-foreground">
              Rango estimado para la zona: ${avm.low.toLocaleString()} – $
              {avm.high.toLocaleString()} MXN
            </p>
            {avm.hasBenchmark ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Basado en el benchmark de $/m² de {data.colonia}, {data.city}.
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-600">
                Sin benchmark para esta colonia aún; la valuación es preliminar.
              </p>
            )}
          </div>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        <BadgePercent className="mr-2 size-4" />
        {isPending ? "Publicando…" : "Publicar y abrir Bidding Hub"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Publicar activa ofertas del Bidding Hub y tu enlace de agenda 24/7 por WhatsApp.
      </p>
    </form>
  );
}
