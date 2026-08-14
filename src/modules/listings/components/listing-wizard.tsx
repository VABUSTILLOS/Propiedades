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

type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEPS: { step: WizardStep; label: string }[] = [
  { step: 1, label: "Información básica" },
  { step: 2, label: "Precio" },
  { step: 3, label: "Ubicación" },
  { step: 4, label: "Multimedia" },
  { step: 5, label: "Contacto" },
];

type WizardField = keyof WizardData;
type WizardData = {
  title: string;
  type: "sale" | "rent";
  category: string;
  dealType: string;
  description: string;
  price: string;
  currency: string;
  terreno_m2: string;
  construccion_m2: string;
  // Investment-specific fields (shown conditionally by deal type).
  costo_reparacion_estimado: string;
  valor_post_reparacion_estimado: string;
  institucion_bancaria: string;
  fecha_remate: string;
  condiciones_traspaso: string;
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
  contact_name: string;
  contact_type: string;
  contact_phone: string;
  contact_whatsapp: string;
  contact_email: string;
};

const initialData: WizardData = {
  title: "",
  type: "sale",
  category: "casa",
  dealType: "venta_directa",
  description: "",
  price: "",
  currency: "MXN",
  terreno_m2: "",
  construccion_m2: "",
  costo_reparacion_estimado: "",
  valor_post_reparacion_estimado: "",
  institucion_bancaria: "",
  fecha_remate: "",
  condiciones_traspaso: "",
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
  contact_name: "",
  contact_type: "",
  contact_phone: "",
  contact_whatsapp: "",
  contact_email: "",
};

/**
 * Five-step listing creation wizard.
 * Step 1 creates the draft row; steps 2–5 update it in place.
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
      form.set("category", data.category);
      form.set("deal_type", data.dealType);
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
        costo_reparacion_estimado:
          data.costo_reparacion_estimado.trim() === ""
            ? null
            : Number(data.costo_reparacion_estimado),
        valor_post_reparacion_estimado:
          data.valor_post_reparacion_estimado.trim() === ""
            ? null
            : Number(data.valor_post_reparacion_estimado),
        institucion_bancaria:
          data.institucion_bancaria.trim() === ""
            ? null
            : data.institucion_bancaria.trim(),
        fecha_remate: data.fecha_remate.trim() === "" ? null : data.fecha_remate.trim(),
        condiciones_traspaso:
          data.condiciones_traspaso.trim() === ""
            ? null
            : data.condiciones_traspaso.trim(),
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
      5: {
        contact_name: data.contact_name.trim() || null,
        contact_type: data.contact_type || null,
        contact_phone: data.contact_phone.trim() || null,
        contact_whatsapp: data.contact_whatsapp.trim() || null,
        contact_email: data.contact_email.trim() || null,
      },
    };

    const res = await saveWizardStep(listingId, step, stepPayload[step]);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setStep((Math.min(step + 1, 5) as WizardStep));
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
        {step === 5 && <StepContact value={data} onChange={updateField} />}

        <div className="flex items-center justify-between pt-2">
          {step > 1 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((step - 1) as WizardStep)}
            >
              Atrás
            </Button>
          ) : (
            <span />
          )}

          <Button type="submit">
            {step === 5
              ? "Terminar"
              : step === 1
                ? "Crear borrador"
                : "Guardar y continuar"}
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
        <Label htmlFor="title">Título</Label>
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
        <Label htmlFor="type">Tipo de listado</Label>
        <Select value={value.type} onValueChange={(v) => onChange("type", v ?? "sale")}>
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sale">En venta</SelectItem>
            <SelectItem value="rent">En renta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Categoría</Label>
          <Select
            value={value.category}
            onValueChange={(v) => onChange("category", v ?? "casa")}
          >
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="casa">Casa</SelectItem>
              <SelectItem value="departamento">Departamento</SelectItem>
              <SelectItem value="local">Local</SelectItem>
              <SelectItem value="bodega">Bodega</SelectItem>
              <SelectItem value="terreno">Terreno</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dealType">Tipo de operación</Label>
          <Select
            value={value.dealType}
            onValueChange={(v) => onChange("dealType", v ?? "venta_directa")}
          >
            <SelectTrigger id="dealType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="venta_directa">Venta directa</SelectItem>
              <SelectItem value="remate_bancario">Remate bancario</SelectItem>
              <SelectItem value="flipping">Flipping (reparar)</SelectItem>
              <SelectItem value="traspaso">Traspaso inmobiliario</SelectItem>
              <SelectItem value="renta">Renta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
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

      {value.dealType === "flipping" && (
        <div className="grid gap-4 rounded-md border border-amber-200 bg-amber-50/50 p-4 sm:grid-cols-2">
          <p className="text-xs font-semibold text-amber-800 sm:col-span-2">
            Flipping — presupuesto de reparación
          </p>
          <div className="space-y-2">
            <Label htmlFor="costo_reparacion_estimado">
              Costo de reparación (MXN)
            </Label>
            <Input
              id="costo_reparacion_estimado"
              name="costo_reparacion_estimado"
              type="number"
              inputMode="numeric"
              min="0"
              value={value.costo_reparacion_estimado}
              onChange={(e) =>
                onChange("costo_reparacion_estimado", e.target.value)
              }
              placeholder="250000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="valor_post_reparacion_estimado">
              Valor post-reparación (ARV) (MXN)
            </Label>
            <Input
              id="valor_post_reparacion_estimado"
              name="valor_post_reparacion_estimado"
              type="number"
              inputMode="numeric"
              min="0"
              value={value.valor_post_reparacion_estimado}
              onChange={(e) =>
                onChange("valor_post_reparacion_estimado", e.target.value)
              }
              placeholder="4500000"
            />
          </div>
        </div>
      )}

      {value.dealType === "remate_bancario" && (
        <div className="grid gap-4 rounded-md border border-emerald-200 bg-emerald-50/50 p-4 sm:grid-cols-2">
          <p className="text-xs font-semibold text-emerald-800 sm:col-span-2">
            Remate bancario — detalles de la subasta
          </p>
          <div className="space-y-2">
            <Label htmlFor="institucion_bancaria">Institución bancaria</Label>
            <Input
              id="institucion_bancaria"
              name="institucion_bancaria"
              value={value.institucion_bancaria}
              onChange={(e) => onChange("institucion_bancaria", e.target.value)}
              placeholder="Ej. BBVA, Banorte…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fecha_remate">Fecha de remate</Label>
            <Input
              id="fecha_remate"
              name="fecha_remate"
              type="date"
              value={value.fecha_remate}
              onChange={(e) => onChange("fecha_remate", e.target.value)}
            />
          </div>
        </div>
      )}

      {value.dealType === "traspaso" && (
        <div className="space-y-2 rounded-md border border-sky-200 bg-sky-50/50 p-4">
          <Label htmlFor="condiciones_traspaso">Condiciones del traspaso</Label>
          <Textarea
            id="condiciones_traspaso"
            name="condiciones_traspaso"
            value={value.condiciones_traspaso}
            onChange={(e) => onChange("condiciones_traspaso", e.target.value)}
            placeholder="Ej. Traspaso de contrato de arrendamiento con 18 meses vigentes, fianza de 2 meses…"
            rows={3}
          />
        </div>
      )}
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

function StepContact({
  value,
  onChange,
}: {
  value: WizardData;
  onChange: (key: WizardField, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="contact_name">Nombre de contacto</Label>
        <Input
          id="contact_name"
          name="contact_name"
          value={value.contact_name}
          onChange={(e) => onChange("contact_name", e.target.value)}
          placeholder="Ej. Inmobiliaria Vanguardia"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact_type">Tipo de contacto</Label>
        <Select
          value={value.contact_type}
          onValueChange={(v) => onChange("contact_type", v ?? "")}
        >
          <SelectTrigger id="contact_type">
            <SelectValue placeholder="Selecciona un tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inmobiliaria">Inmobiliaria</SelectItem>
            <SelectItem value="agencia">Agencia</SelectItem>
            <SelectItem value="particular">Particular</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact_phone">Teléfono</Label>
          <Input
            id="contact_phone"
            name="contact_phone"
            type="tel"
            value={value.contact_phone}
            onChange={(e) => onChange("contact_phone", e.target.value)}
            placeholder="+52 55 0000 0000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_whatsapp">WhatsApp</Label>
          <Input
            id="contact_whatsapp"
            name="contact_whatsapp"
            type="tel"
            value={value.contact_whatsapp}
            onChange={(e) => onChange("contact_whatsapp", e.target.value)}
            placeholder="+52 55 0000 0000"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact_email">Correo electrónico</Label>
        <Input
          id="contact_email"
          name="contact_email"
          type="email"
          value={value.contact_email}
          onChange={(e) => onChange("contact_email", e.target.value)}
          placeholder="contacto@inmobiliaria.com"
        />
      </div>
    </div>
  );
}
