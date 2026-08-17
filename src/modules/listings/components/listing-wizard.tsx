"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";

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
  CircleCheck,
  Clapperboard,
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
  generateListingMedia,
  getMediaJobStatus,
  saveWizardAll,
  saveWizardStep,
  uploadWizardImages,
} from "@/modules/listings/actions";
import { renderPropertyVideo } from "@/modules/listings/media/video-renderer";
import { compressImageForUpload } from "@/modules/listings/media/image-compression";
import { createSupabaseBrowserClient } from "@/modules/lib/supabase/browser";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

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
  { step: 6, label: "Campos avanzados" },
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
  // Step 6 — "Campos avanzados" (master-user edit surface only).
  recamaras: string;
  banos: string;
  estacionamientos: string;
  antiguedad: string;
  precio_m2_const: string;
  precio_m2_terreno: string;
  valor_avaluo: string;
  porcentaje_descuento_avaluo: string;
  estimated_monthly_rent: string;
  cap_rate_projected: string;
  hoa_fee: string;
  predial_anual: string;
  property_score: string;
  noise_score: string;
  flood_risk_level: string;
  is_top: string;
  is_mls: string;
  commission_split: string;
  private_notes: string;
  source_url: string;
  amenidades: string;
  status: string;
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
  recamaras: "",
  banos: "",
  estacionamientos: "",
  antiguedad: "",
  precio_m2_const: "",
  precio_m2_terreno: "",
  valor_avaluo: "",
  porcentaje_descuento_avaluo: "",
  estimated_monthly_rent: "",
  cap_rate_projected: "",
  hoa_fee: "",
  predial_anual: "",
  property_score: "",
  noise_score: "",
  flood_risk_level: "",
  is_top: "",
  is_mls: "",
  commission_split: "",
  private_notes: "",
  source_url: "",
  amenidades: "",
  status: "draft",
};

/**
 * Unified single-form listing editor.
 * All sections (info, pricing, location, media, contact and — for admin
 * edits — advanced fields) render stacked in one scrollable card and persist
 * atomically via `saveWizardAll` (which creates the draft row on first
 * publish). Mutations run through Server Actions (Zod-validated server-side).
 *
 * Pass `initialListing` to edit an existing publication (used by the admin
 * panel): state is seeded from the saved row, the advanced section is shown,
 * and the admin-chosen status is preserved on save.
 */
export function ListingWizard({
  initialMapCenter,
  initialListing,
  adminPanelHref,
}: {
  initialMapCenter?: { lat: number; lng: number; city?: string; state?: string };
  initialListing?: { id: string; slug?: string; data: Partial<WizardData> };
  /** When set, the success screen links back to this admin panel page. */
  adminPanelHref?: string;
}) {
  const [listingId, setListingId] = useState<string | null>(
    initialListing?.id ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WizardData>(() => ({
    ...initialData,
    ...(initialListing?.data ?? {}),
  }));
  const [published, setPublished] = useState<{ id: string; slug: string } | null>(
    null,
  );
  const [isSubmitting, startSubmit] = useTransition();

  const updateField = (key: WizardField, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const setImages = (updater: (prev: WizardImage[]) => WizardImage[]) => {
    setData((prev) => ({ ...prev, images: updater(prev.images) }));
  };

  const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));
  const boolOrNull = (v: string) =>
    v === "true" ? true : v === "false" ? false : null;

  /**
   * Persist the draft row on demand. Media generation needs a stored listing
   * before it can save images, so it calls this when the user hits "Generar"
   * without having published yet. No-op when a listing already exists.
   */
  const ensureListing = async (): Promise<{ id: string | null; error?: string }> => {
    if (listingId) return { id: listingId };
    const form = new FormData();
    form.set("title", data.title);
    form.set("type", data.type);
    form.set("category", data.category);
    form.set("deal_type", data.dealType);
    if (data.description.trim()) form.set("description", data.description.trim());

    const res = await createDraft(undefined, form);
    if (!res.ok) return { id: null, error: res.error };
    setListingId(res.data.id);
    return { id: res.data.id };
  };

  /** Full DB-shaped payload covering every rendered section. */
  const buildFullFields = (): Record<string, unknown> => {
    const fields: Record<string, unknown> = {
      // Step 1 — Información básica.
      title: data.title,
      type: data.type,
      category: data.category,
      deal_type: data.dealType,
      description: data.description.trim() || undefined,
      // Step 2 — Precio.
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
      fecha_remate:
        data.fecha_remate.trim() === "" ? null : data.fecha_remate.trim(),
      condiciones_traspaso:
        data.condiciones_traspaso.trim() === ""
          ? null
          : data.condiciones_traspaso.trim(),
      // Step 3 — Ubicación.
      address: data.address,
      colonia: data.colonia,
      city: data.city,
      state: data.state,
      zip_code: data.zip_code.trim() || undefined,
      lat: Number(data.lat),
      lng: Number(data.lng),
      // Step 4 — Multimedia.
      images: data.images.map((image) => image.url),
      tour_360_url: data.tour_360_url.trim() || null,
      video_url: data.video_url.trim() || null,
      // Step 5 — Contacto.
      contact_name: data.contact_name.trim() || null,
      contact_type: data.contact_type || null,
      contact_phone: data.contact_phone.trim() || null,
      contact_whatsapp: data.contact_whatsapp.trim() || null,
      contact_email: data.contact_email.trim() || null,
    };

    // Step 6 — "Campos avanzados" (admin edit surface only). The status is
    // persisted directly; publishing must not clobber the admin-chosen status.
    if (initialListing) {
      fields.recamaras = numOrNull(data.recamaras);
      fields.banos = numOrNull(data.banos);
      fields.estacionamientos = numOrNull(data.estacionamientos);
      fields.antiguedad = numOrNull(data.antiguedad);
      fields.precio_m2_const = numOrNull(data.precio_m2_const);
      fields.precio_m2_terreno = numOrNull(data.precio_m2_terreno);
      fields.valor_avaluo = numOrNull(data.valor_avaluo);
      fields.porcentaje_descuento_avaluo = numOrNull(
        data.porcentaje_descuento_avaluo,
      );
      fields.estimated_monthly_rent = numOrNull(data.estimated_monthly_rent);
      fields.cap_rate_projected = numOrNull(data.cap_rate_projected);
      fields.hoa_fee = numOrNull(data.hoa_fee);
      fields.predial_anual = numOrNull(data.predial_anual);
      fields.property_score = numOrNull(data.property_score);
      fields.noise_score = numOrNull(data.noise_score);
      fields.flood_risk_level = data.flood_risk_level.trim() || null;
      fields.is_top = boolOrNull(data.is_top);
      fields.is_mls = boolOrNull(data.is_mls);
      fields.commission_split = data.commission_split.trim() || null;
      fields.private_notes = data.private_notes.trim() || null;
      fields.source_url = data.source_url.trim() || null;
      fields.amenidades =
        data.amenidades.trim() === ""
          ? null
          : data.amenidades
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean);
      fields.status = data.status;
    }

    return fields;
  };

  const handleSubmit = () => {
    setError(null);
    startSubmit(async () => {
      const res = await saveWizardAll({
        listingId,
        // New listings always publish on save; admin edits persist the status
        // chosen in the advanced section.
        publish: !initialListing,
        fields: buildFullFields(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPublished({
        id: res.data.id,
        slug: res.data.slug ?? initialListing?.slug ?? "",
      });
    });
  };

  const sections = STEPS.filter(({ step: s }) => initialListing || s !== 6);

  if (published) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-10 text-center shadow-sm">
          <CircleCheck className="size-10 text-emerald-600" />
          <h3 className="text-lg font-semibold">¡Listo!</h3>
          <p className="text-sm text-muted-foreground">
            Tu propiedad quedó publicada y ya es visible para todos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href={`/property/${published.slug}`}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              Ver tu propiedad
            </a>
            <a
              href="/my-listings"
              className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-sm hover:bg-muted"
            >
              Ir a mis listados
            </a>
            {adminPanelHref && (
              <a
                href={adminPanelHref}
                className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-sm hover:bg-muted"
              >
                Volver al panel de administración
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <form
        action={() => void handleSubmit()}
        className="space-y-8 rounded-lg border bg-card p-6 shadow-sm"
      >
        {sections.map(({ step: s, label }, index) => (
          <Fragment key={s}>
            <section className="space-y-4">
              <SectionHeading step={s} label={label} />
              {s === 1 && <StepBasics value={data} onChange={updateField} />}
              {s === 2 && <StepPricing value={data} onChange={updateField} />}
              {s === 3 && (
                <StepLocation
                  value={data}
                  onChange={updateField}
                  initialMapCenter={initialMapCenter}
                />
              )}
              {s === 4 && (
                <StepMedia
                  value={data}
                  onChange={updateField}
                  onImagesChange={setImages}
                  listingId={listingId}
                  onEnsureListing={ensureListing}
                />
              )}
              {s === 5 && <StepContact value={data} onChange={updateField} />}
              {s === 6 && <StepAdvanced value={data} onChange={updateField} />}
            </section>
            {index < sections.length - 1 && <Separator />}
          </Fragment>
        ))}

        {/* Sticky submit bar keeps the single long form usable while scrolling. */}
        <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-between gap-4 rounded-b-lg border-t bg-card/95 px-6 py-4 backdrop-blur">
          <p className="text-xs text-muted-foreground">
            {initialListing
              ? "Los cambios se guardan directamente en la publicación."
              : "Al publicar, la propiedad queda visible para todos."}
          </p>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Guardando…
              </>
            ) : initialListing ? (
              "Guardar cambios"
            ) : (
              "Publicar propiedad"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Small numbered heading used for each section of the unified form. */
function SectionHeading({ step, label }: { step: WizardStep; label: string }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {step}
      </span>
      {label}
    </h2>
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
  listingId,
  onEnsureListing,
}: {
  value: WizardData;
  onChange: (key: WizardField, value: string) => void;
  onImagesChange: (updater: (prev: WizardImage[]) => WizardImage[]) => void;
  listingId: string | null;
  onEnsureListing: () => Promise<{ id: string | null; error?: string }>;
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
      // Comprimir a WebP (máx 1920px) en el navegador antes de subir:
      // fotos de 5-10 MB bajan a ~150-500 KB y la subida es mucho más rápida.
      const compressed = await Promise.all(list.map(compressImageForUpload));
      const formData = new FormData();
      for (const file of compressed) formData.append("images", file);
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

      <MediaGenerationPanel
        listingId={listingId}
        onEnsureListing={onEnsureListing}
        images={value.images}
        videoUrl={value.video_url}
        tourUrl={value.tour_360_url}
        title={value.title}
        priceLabel={
          value.price.trim() && !Number.isNaN(Number(value.price))
            ? `${new Intl.NumberFormat("es-MX", {
                style: "currency",
                currency: value.currency || "MXN",
                maximumFractionDigits: 0,
              }).format(Number(value.price))}${value.type === "rent" ? " /mes" : ""}`
            : ""
        }
        locationLabel={[value.city, value.state].filter(Boolean).join(", ")}
        sizeLabel={[
          value.terreno_m2.trim()
            ? `${Number(value.terreno_m2).toLocaleString("es-MX")} m² terreno`
            : "",
          value.construccion_m2.trim()
            ? `${Number(value.construccion_m2).toLocaleString("es-MX")} m² construcción`
            : "",
        ]
          .filter(Boolean)
          .join(" · ")}
        onChange={onChange}
      />

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

function MediaGenerationPanel({
  listingId,
  onEnsureListing,
  images,
  videoUrl,
  tourUrl,
  title,
  priceLabel,
  locationLabel,
  sizeLabel,
  onChange,
}: {
  listingId: string | null;
  onEnsureListing: () => Promise<{ id: string | null; error?: string }>;
  images: WizardImage[];
  videoUrl: string;
  tourUrl: string;
  title: string;
  priceLabel: string;
  locationLabel: string;
  sizeLabel: string;
  onChange: (key: WizardField, value: string) => void;
}) {
  const [isGenerating, startGenerating] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [videoStatus, setVideoStatus] = useState<
    "idle" | "rendering" | "uploading" | "done" | "failed"
  >("idle");
  const [videoProgress, setVideoProgress] = useState(0);
  const [outputs, setOutputs] = useState<{
    video_url: string | null;
    video_vertical_url: string | null;
    tour_url: string | null;
    tour_type: string | null;
  } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const tourRunning = status === "pending" || status === "processing";
  const videoRunning = videoStatus === "rendering" || videoStatus === "uploading";
  const isRunning = tourRunning || videoRunning;
  const tourDone = status === "done";
  const allDone = tourDone && videoStatus === "done";

  // Poll job status while the worker is running. Stops after ~3 minutes
  // (45 polls × 4s) so a stuck job can't leave the spinner running forever.
  const MAX_POLLS = 45;
  useEffect(() => {
    if (!listingId || !tourRunning) return;
    let polls = 0;
    const timer = setInterval(async () => {
      polls += 1;
      const res = await getMediaJobStatus(listingId);
      if (!res.ok) {
        if (polls >= MAX_POLLS) {
          setStatus("failed");
          setGenError("No pudimos consultar el estado de la generación. Intenta de nuevo.");
        }
        return;
      }
      setStatus(res.data.status);
      setProgress(res.data.progress);
      if (res.data.status === "done") {
        setOutputs(res.data.outputs);
        if (
          res.data.outputs.tour_url &&
          res.data.outputs.tour_type === "panorama_360" &&
          !tourUrl
        ) {
          onChange("tour_360_url", res.data.outputs.tour_url);
        }
      }
      if (res.data.status === "failed") {
        setGenError(res.data.error_message || "La generación del tour falló. Intenta de nuevo.");
      }
      if (polls >= MAX_POLLS && (res.data.status === "pending" || res.data.status === "processing")) {
        setStatus("failed");
        setGenError("La generación del tour tardó demasiado. Intenta de nuevo.");
      }
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, tourRunning]);

  const handleGenerate = async () => {
    if (images.length === 0) {
      setGenError("Sube al menos una imagen para generar el video y tour.");
      return;
    }
    setGenError(null);

    // Media generation needs a persisted listing. If the user hasn't published
    // yet, create the draft on the fly so the wizard never loses its images.
    let id = listingId;
    if (!id) {
      const ensured = await onEnsureListing();
      if (!ensured.id) {
        setGenError(
          ensured.error ??
            "No se pudo guardar el borrador. Escribe el título para poder generar el contenido.",
        );
        return;
      }
      id = ensured.id;
    }
    const targetId = id;

    startGenerating(async () => {
      // Persist current images first so the worker reads fresh data.
      const saveRes = await saveWizardStep(targetId, 4, {
        images: images.map((image) => image.url),
        tour_360_url: tourUrl.trim() || null,
        video_url: videoUrl.trim() || null,
      });
      if (!saveRes.ok) {
        setGenError(saveRes.error);
        return;
      }

      // Tour 360° se genera en el servidor; el video se renderiza aquí mismo
      // en el navegador para obtener un archivo real y reproducible.
      const res = await generateListingMedia(targetId, "tour");
      if (!res.ok) {
        setGenError(res.error);
        return;
      }
      setStatus("pending");
      setProgress(0);
      setOutputs(null);

      setVideoStatus("rendering");
      setVideoProgress(0);
      try {
        const rendered = await renderPropertyVideo(
          {
            imageUrls: images.map((image) => image.url),
            title: title.trim() || undefined,
            priceLabel: priceLabel || undefined,
            locationLabel: locationLabel || undefined,
            sizeLabel: sizeLabel || undefined,
          },
          setVideoProgress,
        );
        setVideoStatus("uploading");
        // Subida directa navegador → Supabase Storage. No pasa por una Server
        // Action: en Vercel las funciones limitan el body a ~4.5 MB y un video
        // siempre lo excede. La policy INSERT de la migración 050 autoriza
        // property-media/wizard/<uid>/ para usuarios autenticados.
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setVideoStatus("failed");
          setGenError("Tu sesión expiró. Vuelve a iniciar sesión.");
          return;
        }
        const videoPath = `wizard/${user.id}/${crypto.randomUUID()}.${rendered.ext}`;
        const { error: uploadError } = await supabase.storage
          .from("property-media")
          .upload(videoPath, rendered.blob, {
            contentType: rendered.blob.type,
            upsert: false,
          });
        if (uploadError) {
          setVideoStatus("failed");
          setGenError(
            `No se pudo subir el video: ${uploadError.message}. Intenta de nuevo.`,
          );
          return;
        }
        const { data: publicUrlData } = supabase.storage
          .from("property-media")
          .getPublicUrl(videoPath);
        if (!publicUrlData.publicUrl) {
          setVideoStatus("failed");
          setGenError("No se pudo obtener la URL del video.");
          return;
        }
        onChange("video_url", publicUrlData.publicUrl);
        setVideoStatus("done");
      } catch (err) {
        setVideoStatus("failed");
        setGenError(
          err instanceof Error
            ? err.message
            : "No se pudo generar el video. Intenta de nuevo.",
        );
      }
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Clapperboard className="size-4 text-primary" />
            Video y tour 360° automáticos
          </p>
          <p className="text-xs text-muted-foreground">
            Generamos un video promocional y un recorrido a partir de tus fotos.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isGenerating || isRunning || images.length === 0}
          onClick={handleGenerate}
        >
          {isGenerating || isRunning ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Generando…
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" />
              Generar
            </>
          )}
        </Button>
      </div>

      {isRunning && (
        <div className="space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${Math.max(videoRunning ? videoProgress : progress, 5)}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {videoStatus === "rendering" &&
              `Generando video en tu navegador… ${videoProgress}%`}
            {videoStatus === "uploading" && "Subiendo el video generado…"}
            {!videoRunning && tourRunning && `Procesando el tour… ${progress}%`}
          </p>
          <p className="text-xs text-muted-foreground">
            Mantén esta pestaña visible mientras se genera el video.
          </p>
        </div>
      )}

      {genError && (
        <p className="text-xs text-destructive" role="alert">
          {genError}
        </p>
      )}

      {(tourDone || videoStatus === "done") && (
        <div className="space-y-2">
          {allDone && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-green-600">
              <CircleCheck className="size-3.5" />
              ¡Listo! Se agregaron las URLs generadas a los campos de abajo.
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {videoStatus === "done" && videoUrl && (
              <video
                src={videoUrl}
                controls
                className="w-full rounded-md border"
              />
            )}
            {(outputs?.tour_url || (tourDone && tourUrl)) && (
              <a
                href={outputs?.tour_url ?? tourUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center rounded-md border bg-background px-3 py-6 text-xs font-medium text-primary hover:underline"
              >
                Abrir tour generado →
              </a>
            )}
          </div>
        </div>
      )}
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

const ADVANCED_STATUS_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "pending_approval", label: "Pendiente de aprobación" },
  { value: "active", label: "Activa" },
  { value: "reserved", label: "Apartada" },
  { value: "sold", label: "Vendida" },
  { value: "archived", label: "Archivada" },
] as const;

/**
 * Step 6 — "Campos avanzados". Master-user only: every remaining editable
 * property field. Numeric inputs accept empty values (stored as NULL), the
 * boolean selects use a "null" sentinel (Radix SelectItem cannot be empty),
 * and amenidades is edited as a comma-separated list.
 */
function StepAdvanced({
  value,
  onChange,
}: {
  value: WizardData;
  onChange: (key: WizardField, value: string) => void;
}) {
  const numField = (
    key: WizardField,
    label: string,
    opts: { id: string; min?: number; max?: number; placeholder?: string },
  ) => (
    <div className="space-y-2">
      <Label htmlFor={opts.id}>{label}</Label>
      <Input
        id={opts.id}
        name={opts.id}
        type="number"
        inputMode="decimal"
        min={opts.min}
        max={opts.max}
        value={value[key] as string}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder={opts.placeholder}
      />
    </div>
  );

  const boolSelect = (key: "is_top" | "is_mls", label: string) => (
    <div className="space-y-2">
      <Label htmlFor={`${key}-select`}>{label}</Label>
      <Select
        value={value[key] || "null"}
        onValueChange={(v) => onChange(key, v == null || v === "null" ? "" : v)}
      >
        <SelectTrigger id={`${key}-select`}>
          <SelectValue placeholder="Selecciona" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="null">Vacío</SelectItem>
          <SelectItem value="true">Sí</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="status-select">Estado de la propiedad</Label>
        <Select
          value={value.status}
          onValueChange={(v) => onChange("status", v ?? "draft")}
        >
          <SelectTrigger id="status-select">
            <SelectValue placeholder="Selecciona un estado" />
          </SelectTrigger>
          <SelectContent>
            {ADVANCED_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          El estado se guarda directamente; no se re-pública automáticamente.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {numField("recamaras", "Recámaras", {
          id: "recamaras",
          min: 0,
          max: 50,
          placeholder: "3",
        })}
        {numField("banos", "Baños", {
          id: "banos",
          min: 0,
          max: 50,
          placeholder: "2",
        })}
        {numField("estacionamientos", "Estacionamientos", {
          id: "estacionamientos",
          min: 0,
          max: 50,
          placeholder: "1",
        })}
        {numField("antiguedad", "Antigüedad (años)", {
          id: "antiguedad",
          min: 0,
          max: 500,
          placeholder: "10",
        })}
        {boolSelect("is_top", "Destacada (is_top)")}
        {boolSelect("is_mls", "Publicada en MLS (is_mls)")}
        {numField("property_score", "Property score (0-100)", {
          id: "property_score",
          min: 0,
          max: 100,
          placeholder: "85",
        })}
        {numField("noise_score", "Noise score (0-100)", {
          id: "noise_score",
          min: 0,
          max: 100,
          placeholder: "20",
        })}
      </div>

      <div className="rounded-md border border-muted p-4">
        <p className="mb-3 text-xs font-semibold text-muted-foreground">
          Valuación y finanzas
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {numField("precio_m2_const", "Precio por m² construcción", {
            id: "precio_m2_const",
            min: 0,
            placeholder: "25000",
          })}
          {numField("precio_m2_terreno", "Precio por m² terreno", {
            id: "precio_m2_terreno",
            min: 0,
            placeholder: "18000",
          })}
          {numField("valor_avaluo", "Valor avalúo", {
            id: "valor_avaluo",
            min: 0,
            placeholder: "3200000",
          })}
          {numField("porcentaje_descuento_avaluo", "Descuento vs avalúo (%)", {
            id: "porcentaje_descuento_avaluo",
            min: 0,
            max: 100,
            placeholder: "10",
          })}
          {numField("estimated_monthly_rent", "Renta mensual estimada", {
            id: "estimated_monthly_rent",
            min: 0,
            placeholder: "18000",
          })}
          {numField("cap_rate_projected", "Cap rate proyectado (%)", {
            id: "cap_rate_projected",
            min: 0,
            placeholder: "6.5",
          })}
          {numField("hoa_fee", "Cuota de mantenimiento (HOA)", {
            id: "hoa_fee",
            min: 0,
            placeholder: "1200",
          })}
          {numField("predial_anual", "Predial anual", {
            id: "predial_anual",
            min: 0,
            placeholder: "4500",
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="flood_risk_level">Nivel de riesgo de inundación</Label>
          <Input
            id="flood_risk_level"
            name="flood_risk_level"
            value={value.flood_risk_level}
            onChange={(e) => onChange("flood_risk_level", e.target.value)}
            placeholder="Ej. bajo, medio, alto"
            maxLength={50}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="commission_split">Comisión / split</Label>
          <Input
            id="commission_split"
            name="commission_split"
            value={value.commission_split}
            onChange={(e) => onChange("commission_split", e.target.value)}
            placeholder="Ej. 3% / 50-50"
            maxLength={200}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="source_url">URL de origen</Label>
        <Input
          id="source_url"
          name="source_url"
          type="url"
          value={value.source_url}
          onChange={(e) => onChange("source_url", e.target.value)}
          placeholder="https://…"
          maxLength={2000}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="amenidades">Amenidades</Label>
        <Textarea
          id="amenidades"
          name="amenidades"
          value={value.amenidades}
          onChange={(e) => onChange("amenidades", e.target.value)}
          placeholder="alberca, gimnasio, seguridad 24h"
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Separa cada amenidad con una coma.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="private_notes">Notas privadas</Label>
        <Textarea
          id="private_notes"
          name="private_notes"
          value={value.private_notes}
          onChange={(e) => onChange("private_notes", e.target.value)}
          placeholder="Anotaciones internas visibles solo para el master user."
          rows={4}
          maxLength={5000}
        />
      </div>
    </div>
  );
}
