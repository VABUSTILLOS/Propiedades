"use client";

import { useRef, useState, useTransition } from "react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Link2,
  Loader2,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";

import {
  createDraft,
  extractWizardText,
  saveWizardStep,
  uploadWizardImages,
} from "@/modules/listings/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { PropertyLocationPicker } from "@/modules/maps/components/property-location-picker";
import { cn } from "@/lib/utils";

type WizardStep = 1 | 2 | 3 | 4 | 5;

/** An image managed by the wizard before the listing is persisted. */
type WizardImage = {
  id: string;
  url: string;
  name?: string;
};

const MAX_WIZARD_IMAGES = 50;
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";

const STEPS: { step: WizardStep; label: string }[] = [
  { step: 1, label: "Información básica" },
  { step: 2, label: "Precio" },
  { step: 3, label: "Ubicación" },
  { step: 4, label: "Multimedia" },
  { step: 5, label: "Contacto" },
];

type WizardField = keyof Omit<WizardData, "images">;
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
  images: WizardImage[];
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
  images: [],
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
export function ListingWizard({
  initialMapCenter,
}: {
  initialMapCenter?: { lat: number; lng: number; city?: string; state?: string };
}) {
  const [step, setStep] = useState<WizardStep>(1);
  const [listingId, setListingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WizardData>(initialData);

  const updateField = (key: WizardField, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const setImages = (updater: (prev: WizardImage[]) => WizardImage[]) => {
    setData((prev) => ({ ...prev, images: updater(prev.images) }));
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
        images: data.images.map((image) => image.url),
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
        {step === 3 && (
          <StepLocation
            value={data}
            onChange={updateField}
            initialMapCenter={initialMapCenter}
          />
        )}
        {step === 4 && (
          <StepMedia value={data} onChange={updateField} onImagesChange={setImages} />
        )}
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
  const [extractText, setExtractText] = useState("");
  const [isExtracting, startExtracting] = useTransition();
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractApplied, setExtractApplied] = useState<number | null>(null);

  const handleExtract = () => {
    const raw = extractText.trim();
    if (raw.length < 20) {
      setExtractError("Escribe al menos una descripción corta para extraer datos.");
      return;
    }
    setExtractError(null);
    setExtractApplied(null);
    startExtracting(async () => {
      const res = await extractWizardText(raw);
      if (!res.ok) {
        setExtractError(res.error);
        return;
      }
      const d = res.data as Partial<Record<WizardField, string | null>> & {
        deal_type?: string | null;
        terreno_m2?: number | null;
        construccion_m2?: number | null;
        price?: number | null;
      };
      let applied = 0;
      const fillIfEmpty = (key: WizardField, val: string | null | undefined) => {
        if (val === null || val === undefined || String(val).trim() === "") return;
        if (value[key as keyof WizardData] === "") {
          onChange(key, String(val));
          applied++;
        }
      };
      const applyExtractedDefault = (
        key: WizardField,
        val: string | null | undefined,
        defaultValue: string,
      ) => {
        if (val === null || val === undefined || String(val).trim() === "") return;
        const next = String(val);
        if (value[key as keyof WizardData] === defaultValue && next !== defaultValue) {
          onChange(key, next);
          applied++;
        }
      };
      fillIfEmpty("title", d.title);
      fillIfEmpty("description", d.description);
      applyExtractedDefault("category", d.category, initialData.category);
      applyExtractedDefault("dealType", d.deal_type ?? null, initialData.dealType);
      fillIfEmpty("address", d.address);
      fillIfEmpty("colonia", d.colonia);
      fillIfEmpty("city", d.city);
      fillIfEmpty("state", d.state);
      fillIfEmpty("zip_code", d.zip_code);
      fillIfEmpty("contact_phone", d.contact_phone);
      fillIfEmpty("contact_whatsapp", d.contact_whatsapp);
      fillIfEmpty("contact_email", d.contact_email);
      if (d.type !== null && d.type !== undefined && value.type === "sale") {
        onChange("type", d.type);
        applied++;
      }
      if (d.price !== null && d.price !== undefined && value.price === "") {
        onChange("price", String(d.price));
        applied++;
      }
      if (
        d.terreno_m2 !== null &&
        d.terreno_m2 !== undefined &&
        value.terreno_m2 === ""
      ) {
        onChange("terreno_m2", String(d.terreno_m2));
        applied++;
      }
      if (
        d.construccion_m2 !== null &&
        d.construccion_m2 !== undefined &&
        value.construccion_m2 === ""
      ) {
        onChange("construccion_m2", String(d.construccion_m2));
        applied++;
      }
      setExtractApplied(applied);
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-dashed bg-muted/30 p-4">
        <Label htmlFor="extract" className="flex items-center gap-1.5">
          <Sparkles className="size-4 text-primary" />
          ¿Tienes el texto del anuncio? Pegalo y extraemos los datos
        </Label>
        <Textarea
          id="extract"
          value={extractText}
          onChange={(e) => setExtractText(e.target.value)}
          placeholder="Ej. Casa en venta en Polanco, 3 recámaras, 120 m² de terreno, 90 m² de construcción. $3,500,000 MXN. Contacto: 55 1234 5678."
          rows={3}
          className="mt-2"
        />
        <div className="mt-2 flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleExtract}
            disabled={isExtracting}
          >
            {isExtracting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Analizando…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Extraer datos
              </>
            )}
          </Button>
          {extractApplied !== null && extractApplied > 0 && (
            <span className="text-xs font-medium text-emerald-600">
              ✓ {extractApplied} dato{extractApplied === 1 ? "" : "s"} aplicado
              {extractApplied === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {extractError && (
          <p className="mt-2 text-xs text-destructive" role="alert">
            {extractError}
          </p>
        )}
      </div>

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
  initialMapCenter,
}: {
  value: WizardData;
  onChange: (key: WizardField, value: string) => void;
  initialMapCenter?: { lat: number; lng: number; city?: string; state?: string };
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <Label>Ubica la propiedad en el mapa</Label>
        <p className="text-xs text-muted-foreground">
          El mapa inicia en tu ciudad aproximada. Haz clic o arrastra el pin y Google
          completará calle, número, colonia y código postal cuando estén disponibles.
        </p>
        <PropertyLocationPicker
          initialLat={value.lat ? Number(value.lat) : initialMapCenter?.lat}
          initialLng={value.lng ? Number(value.lng) : initialMapCenter?.lng}
          initialCity={value.city || initialMapCenter?.city}
          initialState={value.state || initialMapCenter?.state}
          onChange={(result) => {
            onChange("lat", String(result.lat));
            onChange("lng", String(result.lng));
            if (result.address) onChange("address", result.address);
            if (result.colonia) onChange("colonia", result.colonia);
            if (result.city) onChange("city", result.city);
            if (result.state) onChange("state", result.state);
            if (result.zip_code) onChange("zip_code", result.zip_code);
          }}
        />
      </div>

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
  onImagesChange,
}: {
  value: WizardData;
  onChange: (key: WizardField, value: string) => void;
  onImagesChange: (updater: (prev: WizardImage[]) => WizardImage[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, startUploading] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pasteUrl, setPasteUrl] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const remainingSlots = MAX_WIZARD_IMAGES - value.images.length;

  const uploadFiles = (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.size > 0);
    if (list.length === 0) return;
    if (list.length > remainingSlots) {
      setUploadError(`Solo puedes agregar ${remainingSlots} imagen(es) más.`);
      return;
    }
    setUploadError(null);
    startUploading(async () => {
      const formData = new FormData();
      for (const file of list) formData.append("images", file);
      const res = await uploadWizardImages(formData);
      if (!res.ok) {
        setUploadError(res.error);
        return;
      }
      const uploaded: WizardImage[] = res.data.urls.map((url) => ({
        id: crypto.randomUUID(),
        url,
      }));
      onImagesChange((prev) => [...prev, ...uploaded]);
    });
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length > 0) {
      uploadFiles(event.dataTransfer.files);
    }
  };

  const handleReorder = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onImagesChange((prev) => {
      const oldIndex = prev.findIndex((img) => img.id === active.id);
      const newIndex = prev.findIndex((img) => img.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const removeImage = (id: string) => {
    onImagesChange((prev) => prev.filter((img) => img.id !== id));
  };

  const addPasteUrl = () => {
    const url = pasteUrl.trim();
    if (!url) return;
    if (remainingSlots <= 0) {
      setUploadError(`Has alcanzado el límite de ${MAX_WIZARD_IMAGES} imágenes.`);
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setUploadError("Pega una URL válida que empiece con http:// o https://");
      return;
    }
    setUploadError(null);
    onImagesChange((prev) => [...prev, { id: crypto.randomUUID(), url }]);
    setPasteUrl("");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Imágenes de la propiedad</Label>

        {/* Dropzone */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30",
          )}
        >
          <UploadCloud className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            Arrastra tus imágenes aquí o haz clic para subir
          </p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WebP o GIF · máx. 10 MB · {remainingSlots} de{" "}
            {MAX_WIZARD_IMAGES} disponibles
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {uploadError && (
          <p className="text-xs text-destructive" role="alert">
            {uploadError}
          </p>
        )}

        {/* Preview grid with drag-to-reorder */}
        {value.images.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleReorder}
          >
            <SortableContext
              items={value.images.map((img) => img.id)}
              strategy={rectSortingStrategy}
            >
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {value.images.map((img, index) => (
                  <SortableImageCard
                    key={img.id}
                    image={img}
                    index={index}
                    disabled={isUploading}
                    onRemove={() => removeImage(img.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        {isUploading && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Subiendo imágenes…
          </p>
        )}

        {/* URL fallback */}
        <div className="flex items-end gap-2 pt-1">
          <div className="flex-1 space-y-1">
            <Label htmlFor="image-url" className="text-xs">
              ¿Tienes una URL de imagen?
            </Label>
            <div className="flex items-center gap-2">
              <Link2 className="size-4 shrink-0 text-muted-foreground" />
              <Input
                id="image-url"
                value={pasteUrl}
                onChange={(e) => setPasteUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPasteUrl();
                  }
                }}
                placeholder="https://…/foto.jpg"
              />
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addPasteUrl}>
            Agregar
          </Button>
        </div>
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

function SortableImageCard({
  image,
  index,
  disabled,
  onRemove,
}: {
  image: WizardImage;
  index: number;
  disabled: boolean;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg border bg-muted",
        isDragging && "z-10 opacity-90 shadow-lg ring-2 ring-primary",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={`Imagen ${index + 1}`}
        className="size-full object-cover"
        loading="lazy"
        decoding="async"
      />

      {index === 0 && (
        <Badge className="absolute left-1.5 top-1.5 bg-primary/90 text-[10px]">
          Portada
        </Badge>
      )}

      <button
        type="button"
        className="absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Quitar imagen ${index + 1}`}
      >
        <Trash2 className="size-4" />
      </button>

      <button
        type="button"
        aria-label={`Reordenar imagen ${index + 1}`}
        className="absolute bottom-1.5 right-1.5 inline-flex size-7 cursor-grab touch-none items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <span className="pointer-events-none absolute bottom-1.5 left-1.5 inline-flex size-6 items-center justify-center rounded-full bg-black/60 text-xs font-semibold text-white">
        {index + 1}
      </span>
    </li>
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
