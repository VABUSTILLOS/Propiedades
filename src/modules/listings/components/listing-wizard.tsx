"use client";

import { useState } from "react";

import { createDraft, saveWizardStep } from "@/modules/listings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlacesAutocomplete } from "@/modules/maps/components/places-autocomplete";
import { cn } from "@/lib/utils";

type WizardStep = 1 | 2 | 3 | 4;

const STEPS: { step: WizardStep; label: string }[] = [
  { step: 1, label: "Basics" },
  { step: 2, label: "Pricing" },
  { step: 3, label: "Location" },
  { step: 4, label: "Media" },
];

type WizardField = keyof WizardData;
type WizardData = {
  title: string;
  type: "sale" | "rent";
  description: string;
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
  images: string;
  tour_360_url: string;
  video_url: string;
};

const initialData: WizardData = {
  title: "",
  type: "sale",
  description: "",
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
  images: "",
  tour_360_url: "",
  video_url: "",
};

/**
 * Four-step listing creation wizard.
 * Step 1 creates the draft row; steps 2–4 update it in place.
 * Mutations run through Server Actions (Zod-validated server-side).
 */
export function ListingWizard() {
  const [step, setStep] = useState<WizardStep>(1);
  const [listingId, setListingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WizardData>(initialData);

  const updateField = (key: WizardField, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const handleNext = async () => {
    setError(null);

    if (step === 1) {
      const form = new FormData();
      form.set("title", data.title);
      form.set("type", data.type);
      if (data.description.trim()) form.set("description", data.description.trim());

      const res = await createDraft(undefined, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setListingId(res.data.id);
      setStep(2);
      return;
    }

    if (!listingId) return;

    const stepPayload: Record<WizardStep, Record<string, unknown>> = {
      1: {},
      2: {
        price: Number(data.price),
        currency: data.currency,
        terreno_m2: Number(data.terreno_m2),
        construccion_m2: Number(data.construccion_m2),
      },
      3: {
        address: data.address,
        colonia: data.colonia,
        city: data.city,
        state: data.state,
        zip_code: data.zip_code.trim() || undefined,
        lat: Number(data.lat),
        lng: Number(data.lng),
      },
      4: {
        images: data.images
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        tour_360_url: data.tour_360_url.trim() || null,
        video_url: data.video_url.trim() || null,
      },
    };

    const res = await saveWizardStep(listingId, step, stepPayload[step]);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setStep((Math.min(step + 1, 4) as WizardStep));
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Step indicator */}
      <ol className="mb-8 flex items-center gap-2">
        {STEPS.map(({ step: s, label }, index) => (
          <li key={s} className="flex flex-1 flex-col gap-1.5">
            <div
              className={cn(
                "h-1.5 rounded-full",
                s <= step ? "bg-primary" : "bg-muted",
              )}
            />
            <span
              className={cn(
                "text-xs font-medium",
                s === step ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="mr-1 text-muted-foreground">{index + 1}.</span>
              {label}
            </span>
          </li>
        ))}
      </ol>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <form
        action={() => void handleNext()}
        className="space-y-6 rounded-lg border bg-card p-6 shadow-sm"
      >
        {step === 1 && <StepBasics value={data} onChange={updateField} />}
        {step === 2 && <StepPricing value={data} onChange={updateField} />}
        {step === 3 && <StepLocation value={data} onChange={updateField} />}
        {step === 4 && <StepMedia value={data} onChange={updateField} />}

        <div className="flex items-center justify-between pt-2">
          {step > 1 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((step - 1) as WizardStep)}
            >
              Back
            </Button>
          ) : (
            <span />
          )}

          <Button type="submit">
            {step === 4
              ? "Finish"
              : step === 1
                ? "Create draft"
                : "Save & continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function StepBasics({
  value,
  onChange,
}: {
  value: WizardData;
  onChange: (key: WizardField, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          value={value.title}
          onChange={(e) => onChange("title", e.target.value)}
          placeholder="Casa en venta en Polanco"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Listing type</Label>
        <Select value={value.type} onValueChange={(v) => onChange("type", v ?? "sale")}>
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sale">For sale</SelectItem>
            <SelectItem value="rent">For rent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          value={value.description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Describe la propiedad…"
          rows={4}
        />
      </div>
    </div>
  );
}

function StepPricing({
  value,
  onChange,
}: {
  value: WizardData;
  onChange: (key: WizardField, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="price">Precio (MXN)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            inputMode="numeric"
            min="0"
            value={value.price}
            onChange={(e) => onChange("price", e.target.value)}
            placeholder="3500000"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="terreno_m2">Terreno (m²)</Label>
          <Input
            id="terreno_m2"
            name="terreno_m2"
            type="number"
            inputMode="decimal"
            min="0"
            value={value.terreno_m2}
            onChange={(e) => onChange("terreno_m2", e.target.value)}
            placeholder="120"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="construccion_m2">Construcción (m²)</Label>
        <Input
          id="construccion_m2"
          name="construccion_m2"
          type="number"
          inputMode="decimal"
          min="0"
          value={value.construccion_m2}
          onChange={(e) => onChange("construccion_m2", e.target.value)}
          placeholder="90"
          required
        />
      </div>
    </div>
  );
}

function StepLocation({
  value,
  onChange,
}: {
  value: WizardData;
  onChange: (key: WizardField, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="address">Dirección</Label>
        <PlacesAutocomplete
          value={value.address}
          placeholder="Av. Masaryk 123, Int. 4"
          onSelect={(result) => {
            onChange("address", result.formatted_address);
            if (result.colonia) onChange("colonia", result.colonia);
            if (result.city) onChange("city", result.city);
            if (result.state) onChange("state", result.state);
            if (result.zip_code) onChange("zip_code", result.zip_code);
            if (result.lat !== null) onChange("lat", String(result.lat));
            if (result.lng !== null) onChange("lng", String(result.lng));
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="colonia">Colonia</Label>
          <Input
            id="colonia"
            name="colonia"
            value={value.colonia}
            onChange={(e) => onChange("colonia", e.target.value)}
            placeholder="Polanco"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip_code">Código postal</Label>
          <Input
            id="zip_code"
            name="zip_code"
            value={value.zip_code}
            onChange={(e) => onChange("zip_code", e.target.value)}
            placeholder="11560"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">Ciudad</Label>
          <Input
            id="city"
            name="city"
            value={value.city}
            onChange={(e) => onChange("city", e.target.value)}
            placeholder="Ciudad de México"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">Estado</Label>
          <Input
            id="state"
            name="state"
            value={value.state}
            onChange={(e) => onChange("state", e.target.value)}
            placeholder="CDMX"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lat">Latitud</Label>
          <Input
            id="lat"
            name="lat"
            type="number"
            inputMode="decimal"
            step="any"
            value={value.lat}
            onChange={(e) => onChange("lat", e.target.value)}
            placeholder="19.4326"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lng">Longitud</Label>
          <Input
            id="lng"
            name="lng"
            type="number"
            inputMode="decimal"
            step="any"
            value={value.lng}
            onChange={(e) => onChange("lng", e.target.value)}
            placeholder="-99.1332"
            required
          />
        </div>
      </div>
    </div>
  );
}

function StepMedia({
  value,
  onChange,
}: {
  value: WizardData;
  onChange: (key: WizardField, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="images">URLs de imágenes</Label>
        <Textarea
          id="images"
          name="images"
          value={value.images}
          onChange={(e) => onChange("images", e.target.value)}
          placeholder="https://example.com/photo.jpg"
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          URLs separadas por comas (hasta 50).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tour_360_url">URL del tour 360°</Label>
          <Input
            id="tour_360_url"
            name="tour_360_url"
            value={value.tour_360_url}
            onChange={(e) => onChange("tour_360_url", e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="video_url">URL del video</Label>
          <Input
            id="video_url"
            name="video_url"
            value={value.video_url}
            onChange={(e) => onChange("video_url", e.target.value)}
            placeholder="https://…"
          />
        </div>
      </div>
    </div>
  );
}
