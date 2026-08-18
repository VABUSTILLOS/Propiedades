"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Bath,
  BedDouble,
  Building2,
  Calculator,
  CalendarClock,
  Car,
  ChevronDown,
  GripVertical,
  LandPlot,
  Link2,
  Loader2,
  Pencil,
  Save,
  Trash2,
  UploadCloud,
  X,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScoreBadge } from "@/components/ui/score-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { savePropertyInline } from "@/modules/admin/actions";
import { uploadWizardImages } from "@/modules/listings/actions";
import { compressImageForUpload } from "@/modules/listings/media/image-compression";
import { EditorModeToggle } from "@/modules/admin/components/editor-mode-toggle";
import { PropertyModerationActions } from "@/modules/admin/components/property-moderation-actions";
import { HotnessGauge } from "@/modules/market-data/components/hotness-gauge";
import {
  estimateEscrituracion,
  estimatePredial,
  formatMxn,
} from "@/modules/lib/real-estate";
import type {
  ListingType,
  PropertyCategory,
  PropertyDealType,
  PropertyStatus,
} from "@/modules/lib/database.types";

/**
 * JSON-safe subset of `PropertiesRow` passed from the server detail page to
 * the inline editor. Excludes non-serializable columns (geog, embedding,
 * price_history, tax_history, neighborhood_vibe, nearby_schools,
 * puntos_fuertes_bento, ai_extracted, missing_fields). `amenidades` is the
 * Json array narrowed to strings and `images` is always an array.
 */
export type InlineListingData = {
  id: string;
  slug: string;
  title: string;
  type: ListingType;
  category: PropertyCategory;
  deal_type: PropertyDealType;
  status: PropertyStatus;
  description: string | null;
  address: string;
  colonia: string;
  city: string;
  state: string;
  zip_code: string | null;
  lat: number;
  lng: number;
  price: number;
  currency: string;
  terreno_m2: number;
  construccion_m2: number;
  precio_m2_const: number | null;
  precio_m2_terreno: number | null;
  recamaras: number | null;
  banos: number | null;
  estacionamientos: number | null;
  antiguedad: number | null;
  contact_name: string | null;
  contact_type: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  contact_email: string | null;
  property_score: number | null;
  noise_score: number | null;
  flood_risk_level: string | null;
  is_top: boolean | null;
  is_mls: boolean | null;
  commission_split: string | null;
  private_notes: string | null;
  source_url: string | null;
  video_url: string | null;
  tour_360_url: string | null;
  amenidades: string[];
  images: string[];
  costo_reparacion_estimado: number | null;
  valor_post_reparacion_estimado: number | null;
  institucion_bancaria: string | null;
  fecha_remate: string | null;
  condiciones_traspaso: string | null;
};

const MAX_INLINE_IMAGES = 50;

const STATUS_OPTIONS: { value: PropertyStatus; label: string }[] = [
  { value: "draft", label: "Borrador" },
  { value: "pending_approval", label: "Pendiente de aprobación" },
  { value: "active", label: "Activa" },
  { value: "reserved", label: "Apartada" },
  { value: "sold", label: "Vendida" },
  { value: "archived", label: "Archivada" },
];

const CONTACT_TYPE_OPTIONS = [
  { value: "inmobiliaria", label: "Inmobiliaria" },
  { value: "agencia", label: "Agencia" },
  { value: "particular", label: "Particular" },
];

/** Numeric inputs hold strings; empty string maps to NULL on save. */
type InlineFormValues = {
  title: string;
  address: string;
  colonia: string;
  city: string;
  state: string;
  description: string;
  price: string;
  currency: string;
  precio_m2_const: string;
  precio_m2_terreno: string;
  terreno_m2: string;
  construccion_m2: string;
  recamaras: string;
  banos: string;
  estacionamientos: string;
  antiguedad: string;
  zip_code: string;
  contact_name: string;
  contact_type: string;
  contact_phone: string;
  contact_whatsapp: string;
  contact_email: string;
  status: PropertyStatus;
  is_top: string;
  is_mls: string;
  property_score: string;
  noise_score: string;
  flood_risk_level: string;
  source_url: string;
  video_url: string;
  tour_360_url: string;
  amenidades: string;
  commission_split: string;
  private_notes: string;
  costo_reparacion_estimado: string;
  valor_post_reparacion_estimado: string;
  institucion_bancaria: string;
  fecha_remate: string;
  condiciones_traspaso: string;
  images: string[];
};

function boolToTri(value: boolean | null): "" | "true" | "false" {
  if (value === true) return "true";
  if (value === false) return "false";
  return "";
}

function toInlineFormValues(listing: InlineListingData): InlineFormValues {
  return {
    title: listing.title,
    address: listing.address,
    colonia: listing.colonia,
    city: listing.city,
    state: listing.state,
    description: listing.description ?? "",
    price: String(listing.price),
    currency: listing.currency,
    precio_m2_const:
      listing.precio_m2_const == null ? "" : String(listing.precio_m2_const),
    precio_m2_terreno:
      listing.precio_m2_terreno == null ? "" : String(listing.precio_m2_terreno),
    terreno_m2: String(listing.terreno_m2),
    construccion_m2: String(listing.construccion_m2),
    recamaras: listing.recamaras == null ? "" : String(listing.recamaras),
    banos: listing.banos == null ? "" : String(listing.banos),
    estacionamientos:
      listing.estacionamientos == null ? "" : String(listing.estacionamientos),
    antiguedad: listing.antiguedad == null ? "" : String(listing.antiguedad),
    zip_code: listing.zip_code ?? "",
    contact_name: listing.contact_name ?? "",
    contact_type: listing.contact_type ?? "",
    contact_phone: listing.contact_phone ?? "",
    contact_whatsapp: listing.contact_whatsapp ?? "",
    contact_email: listing.contact_email ?? "",
    status: listing.status,
    is_top: boolToTri(listing.is_top),
    is_mls: boolToTri(listing.is_mls),
    property_score:
      listing.property_score == null ? "" : String(listing.property_score),
    noise_score: listing.noise_score == null ? "" : String(listing.noise_score),
    flood_risk_level: listing.flood_risk_level ?? "",
    source_url: listing.source_url ?? "",
    video_url: listing.video_url ?? "",
    tour_360_url: listing.tour_360_url ?? "",
    amenidades: (listing.amenidades ?? []).join(", "),
    commission_split: listing.commission_split ?? "",
    private_notes: listing.private_notes ?? "",
    costo_reparacion_estimado:
      listing.costo_reparacion_estimado == null
        ? ""
        : String(listing.costo_reparacion_estimado),
    valor_post_reparacion_estimado:
      listing.valor_post_reparacion_estimado == null
        ? ""
        : String(listing.valor_post_reparacion_estimado),
    institucion_bancaria: listing.institucion_bancaria ?? "",
    fecha_remate: listing.fecha_remate ?? "",
    condiciones_traspaso: listing.condiciones_traspaso ?? "",
    images: listing.images ?? [],
  };
}

function numOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isNaN(n) ? null : n;
}

function boolOrNull(value: string): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function urlOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Mirror of the wizard's `buildFullFields()`: converts the form state back to
 * the field map validated by `propertyCreateSchema` + `propertyWizardStep6Schema`
 * in saveWizardAll. Empty strings become null/undefined and non-editable
 * columns (type, category, deal_type, lat/lng) pass through from the listing
 * unchanged. `images` (order + additions/removals) comes from the form state.
 */
function buildInlineFields(
  form: InlineFormValues,
  listing: InlineListingData,
): Record<string, unknown> {
  return {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    type: listing.type,
    category: listing.category,
    deal_type: listing.deal_type,
    price: numOrNull(form.price),
    currency: form.currency.trim() || "MXN",
    terreno_m2: numOrNull(form.terreno_m2),
    construccion_m2: numOrNull(form.construccion_m2),
    precio_m2_const: numOrNull(form.precio_m2_const),
    precio_m2_terreno: numOrNull(form.precio_m2_terreno),
    address: form.address.trim(),
    colonia: form.colonia.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    zip_code: form.zip_code.trim() || undefined,
    lat: listing.lat,
    lng: listing.lng,
    images: form.images,
    recamaras: numOrNull(form.recamaras),
    banos: numOrNull(form.banos),
    estacionamientos: numOrNull(form.estacionamientos),
    antiguedad: numOrNull(form.antiguedad),
    contact_name: form.contact_name.trim() || null,
    contact_type: form.contact_type.trim() || null,
    contact_phone: form.contact_phone.trim() || null,
    contact_whatsapp: form.contact_whatsapp.trim() || null,
    contact_email: form.contact_email.trim() || null,
    status: form.status,
    is_top: boolOrNull(form.is_top),
    is_mls: boolOrNull(form.is_mls),
    property_score: numOrNull(form.property_score),
    noise_score: numOrNull(form.noise_score),
    flood_risk_level: form.flood_risk_level.trim() || null,
    source_url: urlOrNull(form.source_url),
    video_url: urlOrNull(form.video_url),
    tour_360_url: urlOrNull(form.tour_360_url),
    amenidades: form.amenidades
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean)
      .slice(0, 50),
    commission_split: form.commission_split.trim() || null,
    private_notes: form.private_notes.trim() || null,
    costo_reparacion_estimado: numOrNull(form.costo_reparacion_estimado),
    valor_post_reparacion_estimado: numOrNull(
      form.valor_post_reparacion_estimado,
    ),
    institucion_bancaria: form.institucion_bancaria.trim() || null,
    fecha_remate: form.fecha_remate.trim() || null,
    condiciones_traspaso: form.condiciones_traspaso.trim() || null,
  };
}

type PropertyInlineEditorProps = {
  listing: InlineListingData;
  canEdit: boolean;
  editorMode: boolean;
  showOwnerEditLink: boolean;
  from: string;
  discountPct: number | null;
  hotScore: number | null;
  financiable: boolean;
  gallery: ReactNode;
  map: ReactNode;
  media: ReactNode;
  viewToggle: ReactNode;
  similar: ReactNode;
  asideCtas: ReactNode;
  mobileCta: ReactNode;
};

/**
 * Detail-page wrapper for the master user's inline editing. Renders the page
 * exactly as before while not editing; a single global "Editar" button (no
 * editor-mode cookie required) swaps the editable sections for in-place form
 * fields, with one "Guardar cambios" action that reuses the admin wizard's
 * validation via saveWizardAll.
 */
export function PropertyInlineEditor({
  listing,
  canEdit,
  editorMode,
  showOwnerEditLink,
  from,
  discountPct,
  hotScore,
  financiable,
  gallery,
  map,
  media,
  viewToggle,
  similar,
  asideCtas,
  mobileCta,
}: PropertyInlineEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [form, setForm] = useState<InlineFormValues>(() =>
    toInlineFormValues(listing),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const setField = <K extends keyof InlineFormValues>(
    key: K,
    value: InlineFormValues[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleStartEdit = () => {
    setForm(toInlineFormValues(listing));
    setError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setError(null);
    setEditing(false);
    setAdvancedOpen(false);
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await savePropertyInline(listing.id, buildInlineFields(form, listing));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
      setAdvancedOpen(false);
      router.refresh();
    });
  };

  const priceCardStatic = (
    <Card className="sticky top-24 rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle>Precio</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">
          ${listing.price.toLocaleString()}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {listing.currency}
          </span>
        </p>
        {discountPct != null && (
          <div
            className={cn(
              "mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
              discountPct >= 0
                ? "bg-emerald-600/10 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:text-amber-400",
            )}
          >
            {discountPct >= 0 ? (
              <>
                <ArrowDownRight className="size-3.5" />
                {discountPct.toFixed(1)}% vs. colonia
              </>
            ) : (
              <>
                <ArrowUpRight className="size-3.5" />
                {Math.abs(discountPct).toFixed(1)}% arriba vs. colonia
              </>
            )}
          </div>
        )}
        {listing.precio_m2_const != null && (
          <p className="mt-3 text-sm text-muted-foreground">
            ~${listing.precio_m2_const.toLocaleString()} / m² construido
          </p>
        )}
        {listing.precio_m2_terreno != null && (
          <p className="text-sm text-muted-foreground">
            ~${listing.precio_m2_terreno.toLocaleString()} / m² terreno
          </p>
        )}

        {listing.type === "sale" && listing.price > 0 && (
          <dl className="mt-4 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Predial estimado (anual)</dt>
              <dd className="font-medium">
                {formatMxn(estimatePredial(listing.price))}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Escrituración estimada</dt>
              <dd className="font-medium">
                {formatMxn(estimateEscrituracion(listing.price))}
              </dd>
            </div>
          </dl>
        )}

        {hotScore != null && (
          <div className="mt-4 rounded-xl border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Oportunidad</p>
              <span className="text-xs font-medium text-muted-foreground">
                {hotScore}/100
              </span>
            </div>
            <HotnessGauge score={hotScore} />
            <dl className="mt-3 space-y-1 border-t pt-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <dt>Ahorro vs. colonia (50%)</dt>
                <dd className="font-medium text-foreground">
                  {discountPct != null ? `${discountPct.toFixed(1)}%` : "Sin dato"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>$/m² construido (50%)</dt>
                <dd className="font-medium text-foreground">
                  {listing.precio_m2_const != null
                    ? `$${listing.precio_m2_const.toLocaleString()}`
                    : listing.precio_m2_terreno != null
                      ? `$${listing.precio_m2_terreno.toLocaleString()}`
                      : "Sin dato"}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {financiable && listing.type === "sale" && listing.price > 0 && (
          <a
            href="#simulador"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Calculator className="size-3.5" aria-hidden />
            Acepta crédito hipotecario — simula tu mensualidad y compara bancos
          </a>
        )}
      </CardContent>
    </Card>
  );

  const priceCardEdit = (
    <Card className="sticky top-24 rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle>Precio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <EditableField id="price" label="Precio (MXN)">
          <Input
            id="price"
            name="price"
            type="number"
            inputMode="decimal"
            min={0}
            value={form.price}
            onChange={(e) => setField("price", e.target.value)}
          />
        </EditableField>
        <EditableField id="currency" label="Moneda">
          <Input
            id="currency"
            name="currency"
            maxLength={3}
            value={form.currency}
            onChange={(e) => setField("currency", e.target.value.toUpperCase())}
          />
        </EditableField>
        <EditableField id="precio_m2_const" label="$ / m² construido">
          <Input
            id="precio_m2_const"
            name="precio_m2_const"
            type="number"
            inputMode="decimal"
            min={0}
            value={form.precio_m2_const}
            onChange={(e) => setField("precio_m2_const", e.target.value)}
          />
        </EditableField>
        <EditableField id="precio_m2_terreno" label="$ / m² terreno">
          <Input
            id="precio_m2_terreno"
            name="precio_m2_terreno"
            type="number"
            inputMode="decimal"
            min={0}
            value={form.precio_m2_terreno}
            onChange={(e) => setField("precio_m2_terreno", e.target.value)}
          />
        </EditableField>
        <p className="text-xs text-muted-foreground">
          Predial y escrituración estimados se recalculan al guardar.
        </p>
      </CardContent>
    </Card>
  );

  const detailsCardStatic = (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Detalles</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2 text-sm">
          <DetailRow
            icon={LandPlot}
            label={listing.category === "terreno" ? "m² lote" : "m² terreno"}
            value={`${listing.terreno_m2} m²`}
          />
          <DetailRow
            icon={Building2}
            label="m² construido"
            value={`${listing.construccion_m2} m²`}
          />
          {listing.recamaras != null && (
            <DetailRow
              icon={BedDouble}
              label="Recámaras"
              value={String(listing.recamaras)}
            />
          )}
          {listing.banos != null && (
            <DetailRow icon={Bath} label="Baños" value={String(listing.banos)} />
          )}
          {listing.estacionamientos != null && (
            <DetailRow
              icon={Car}
              label="Estacionamientos"
              value={String(listing.estacionamientos)}
            />
          )}
          {listing.antiguedad != null && (
            <DetailRow
              icon={CalendarClock}
              label="Antigüedad"
              value={`${listing.antiguedad} años`}
            />
          )}
          {listing.zip_code && (
            <DetailRow label="C.P." value={listing.zip_code} />
          )}
          <DetailRow
            label="Ubicación"
            value={`${listing.lat.toFixed(4)}, ${listing.lng.toFixed(4)}`}
          />
        </dl>
      </CardContent>
    </Card>
  );

  const detailsCardEdit = (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Detalles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <EditableField id="terreno_m2" label="m² terreno">
            <Input
              id="terreno_m2"
              name="terreno_m2"
              type="number"
              inputMode="decimal"
              min={0}
              value={form.terreno_m2}
              onChange={(e) => setField("terreno_m2", e.target.value)}
            />
          </EditableField>
          <EditableField id="construccion_m2" label="m² construido">
            <Input
              id="construccion_m2"
              name="construccion_m2"
              type="number"
              inputMode="decimal"
              min={0}
              value={form.construccion_m2}
              onChange={(e) => setField("construccion_m2", e.target.value)}
            />
          </EditableField>
          <EditableField id="recamaras" label="Recámaras">
            <Input
              id="recamaras"
              name="recamaras"
              type="number"
              inputMode="numeric"
              min={0}
              value={form.recamaras}
              onChange={(e) => setField("recamaras", e.target.value)}
            />
          </EditableField>
          <EditableField id="banos" label="Baños">
            <Input
              id="banos"
              name="banos"
              type="number"
              inputMode="numeric"
              min={0}
              value={form.banos}
              onChange={(e) => setField("banos", e.target.value)}
            />
          </EditableField>
          <EditableField id="estacionamientos" label="Estacionamientos">
            <Input
              id="estacionamientos"
              name="estacionamientos"
              type="number"
              inputMode="numeric"
              min={0}
              value={form.estacionamientos}
              onChange={(e) => setField("estacionamientos", e.target.value)}
            />
          </EditableField>
          <EditableField id="antiguedad" label="Antigüedad (años)">
            <Input
              id="antiguedad"
              name="antiguedad"
              type="number"
              inputMode="numeric"
              min={0}
              value={form.antiguedad}
              onChange={(e) => setField("antiguedad", e.target.value)}
            />
          </EditableField>
        </div>
        <EditableField id="zip_code" label="Código postal">
          <Input
            id="zip_code"
            name="zip_code"
            maxLength={10}
            value={form.zip_code}
            onChange={(e) => setField("zip_code", e.target.value)}
          />
        </EditableField>
      </CardContent>
    </Card>
  );

  const contactCardStatic = listing.contact_name ? (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Contacto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="font-medium">{listing.contact_name}</p>
        {listing.contact_type && (
          <p className="text-muted-foreground capitalize">
            {listing.contact_type === "inmobiliaria"
              ? "Inmobiliaria"
              : listing.contact_type}
          </p>
        )}
        {listing.contact_phone && (
          <a
            href={`tel:+52${listing.contact_phone}`}
            className="block font-medium text-primary hover:underline"
          >
            {formatPhoneDisplay(listing.contact_phone)}
          </a>
        )}
        {listing.contact_whatsapp && (
          <a
            href={`https://wa.me/52${listing.contact_whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block font-medium text-primary hover:underline"
          >
            Enviar WhatsApp
          </a>
        )}
        {listing.contact_email && (
          <a
            href={`mailto:${listing.contact_email}`}
            className="block font-medium text-primary hover:underline"
          >
            {listing.contact_email}
          </a>
        )}
      </CardContent>
    </Card>
  ) : null;

  const contactCardEdit = (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Contacto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <EditableField id="contact_name" label="Nombre">
          <Input
            id="contact_name"
            name="contact_name"
            value={form.contact_name}
            onChange={(e) => setField("contact_name", e.target.value)}
          />
        </EditableField>
        <EditableField id="contact_type" label="Tipo de contacto">
          <Select
            value={form.contact_type || "null"}
            onValueChange={(v) =>
              setField(
                "contact_type",
                v == null || v === "null" ? "" : v,
              )
            }
          >
            <SelectTrigger id="contact_type" className="w-full">
              <SelectValue placeholder="Selecciona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="null">Vacío</SelectItem>
              {CONTACT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </EditableField>
        <EditableField id="contact_phone" label="Teléfono">
          <Input
            id="contact_phone"
            name="contact_phone"
            value={form.contact_phone}
            onChange={(e) => setField("contact_phone", e.target.value)}
          />
        </EditableField>
        <EditableField id="contact_whatsapp" label="WhatsApp">
          <Input
            id="contact_whatsapp"
            name="contact_whatsapp"
            value={form.contact_whatsapp}
            onChange={(e) => setField("contact_whatsapp", e.target.value)}
          />
        </EditableField>
        <EditableField id="contact_email" label="Correo">
          <Input
            id="contact_email"
            name="contact_email"
            type="email"
            value={form.contact_email}
            onChange={(e) => setField("contact_email", e.target.value)}
          />
        </EditableField>
      </CardContent>
    </Card>
  );

  const advancedSection = (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setAdvancedOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown
          className={cn(
            "size-4 transition-transform",
            advancedOpen && "rotate-180",
          )}
        />
        Campos avanzados
      </button>
      {advancedOpen && (
        <Card className="mt-3 rounded-2xl">
          <CardContent className="space-y-6 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <EditableField id="is_top" label="Destacado (is_top)">
                <Select
                  value={form.is_top || "null"}
                  onValueChange={(v) =>
                    setField("is_top", v == null || v === "null" ? "" : v)
                  }
                >
                  <SelectTrigger id="is_top" className="w-full">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Vacío</SelectItem>
                    <SelectItem value="true">Sí</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </EditableField>
              <EditableField id="is_mls" label="En MLS (is_mls)">
                <Select
                  value={form.is_mls || "null"}
                  onValueChange={(v) =>
                    setField("is_mls", v == null || v === "null" ? "" : v)
                  }
                >
                  <SelectTrigger id="is_mls" className="w-full">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Vacío</SelectItem>
                    <SelectItem value="true">Sí</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </EditableField>
              <EditableField id="property_score" label="Score de la propiedad (0-100)">
                <Input
                  id="property_score"
                  name="property_score"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={form.property_score}
                  onChange={(e) => setField("property_score", e.target.value)}
                />
              </EditableField>
              <EditableField id="noise_score" label="Ruido (0-100)">
                <Input
                  id="noise_score"
                  name="noise_score"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={form.noise_score}
                  onChange={(e) => setField("noise_score", e.target.value)}
                />
              </EditableField>
              <EditableField id="flood_risk_level" label="Riesgo de inundación">
                <Input
                  id="flood_risk_level"
                  name="flood_risk_level"
                  maxLength={50}
                  value={form.flood_risk_level}
                  onChange={(e) => setField("flood_risk_level", e.target.value)}
                />
              </EditableField>
              <EditableField id="source_url" label="URL de la fuente (Vivanuncios)">
                <Input
                  id="source_url"
                  name="source_url"
                  type="url"
                  value={form.source_url}
                  onChange={(e) => setField("source_url", e.target.value)}
                />
              </EditableField>
              <EditableField id="video_url" label="URL del video">
                <Input
                  id="video_url"
                  name="video_url"
                  type="url"
                  value={form.video_url}
                  onChange={(e) => setField("video_url", e.target.value)}
                />
              </EditableField>
              <EditableField id="tour_360_url" label="URL del tour 360°">
                <Input
                  id="tour_360_url"
                  name="tour_360_url"
                  type="url"
                  value={form.tour_360_url}
                  onChange={(e) => setField("tour_360_url", e.target.value)}
                />
              </EditableField>
              <EditableField id="commission_split" label="Comisión / split">
                <Input
                  id="commission_split"
                  name="commission_split"
                  value={form.commission_split}
                  onChange={(e) => setField("commission_split", e.target.value)}
                />
              </EditableField>
              <EditableField id="private_notes" label="Notas privadas">
                <Input
                  id="private_notes"
                  name="private_notes"
                  value={form.private_notes}
                  onChange={(e) => setField("private_notes", e.target.value)}
                />
              </EditableField>
              <EditableField
                id="costo_reparacion_estimado"
                label="Costo de reparación estimado"
              >
                <Input
                  id="costo_reparacion_estimado"
                  name="costo_reparacion_estimado"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={form.costo_reparacion_estimado}
                  onChange={(e) =>
                    setField("costo_reparacion_estimado", e.target.value)
                  }
                />
              </EditableField>
              <EditableField
                id="valor_post_reparacion_estimado"
                label="Valor post-reparación estimado"
              >
                <Input
                  id="valor_post_reparacion_estimado"
                  name="valor_post_reparacion_estimado"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={form.valor_post_reparacion_estimado}
                  onChange={(e) =>
                    setField("valor_post_reparacion_estimado", e.target.value)
                  }
                />
              </EditableField>
              <EditableField id="institucion_bancaria" label="Institución bancaria">
                <Input
                  id="institucion_bancaria"
                  name="institucion_bancaria"
                  value={form.institucion_bancaria}
                  onChange={(e) =>
                    setField("institucion_bancaria", e.target.value)
                  }
                />
              </EditableField>
              <EditableField id="fecha_remate" label="Fecha de remate">
                <Input
                  id="fecha_remate"
                  name="fecha_remate"
                  value={form.fecha_remate}
                  onChange={(e) => setField("fecha_remate", e.target.value)}
                />
              </EditableField>
            </div>
            <EditableField id="condiciones_traspaso" label="Condiciones de traspaso">
              <Textarea
                id="condiciones_traspaso"
                name="condiciones_traspaso"
                rows={3}
                value={form.condiciones_traspaso}
                onChange={(e) => setField("condiciones_traspaso", e.target.value)}
              />
            </EditableField>
            <EditableField
              id="amenidades"
              label="Amenidades (separadas por coma)"
            >
              <Textarea
                id="amenidades"
                name="amenidades"
                rows={3}
                value={form.amenidades}
                onChange={(e) => setField("amenidades", e.target.value)}
                placeholder="Alberca, gimnasio, seguridad 24h"
              />
            </EditableField>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pt-10 pb-28 lg:pb-10">
        <Link
          href={from}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a listados
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {editing ? (
              <div className="space-y-3">
                <EditableField id="title" label="Título">
                  <Input
                    id="title"
                    name="title"
                    value={form.title}
                    onChange={(e) => setField("title", e.target.value)}
                  />
                </EditableField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <EditableField id="address" label="Dirección">
                    <Input
                      id="address"
                      name="address"
                      value={form.address}
                      onChange={(e) => setField("address", e.target.value)}
                    />
                  </EditableField>
                  <EditableField id="colonia" label="Colonia">
                    <Input
                      id="colonia"
                      name="colonia"
                      value={form.colonia}
                      onChange={(e) => setField("colonia", e.target.value)}
                    />
                  </EditableField>
                  <EditableField id="city" label="Ciudad">
                    <Input
                      id="city"
                      name="city"
                      value={form.city}
                      onChange={(e) => setField("city", e.target.value)}
                    />
                  </EditableField>
                  <EditableField id="state" label="Estado">
                    <Input
                      id="state"
                      name="state"
                      value={form.state}
                      onChange={(e) => setField("state", e.target.value)}
                    />
                  </EditableField>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold tracking-tight">
                  {listing.title}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {listing.address} · {listing.colonia}, {listing.city},{" "}
                  {listing.state}
                </p>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={listing.type === "rent" ? "secondary" : "default"}
              className="rounded-full shadow-sm"
            >
              {listing.type === "rent" ? "En renta" : "En venta"}
            </Badge>
            <ScoreBadge
              score={listing.property_score}
              className="rounded-full shadow-sm"
            />
            {showOwnerEditLink && (
              <Link
                href={`/listings/${listing.id}/editar`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-1.5",
                )}
              >
                <Pencil className="size-4" />
                Editar propiedad
              </Link>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/50 px-4 py-3">
            <p className="text-sm font-medium text-muted-foreground">
              {editing
                ? "Editando (usuario master)"
                : "Moderación (usuario master)"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {editing ? (
                <>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setField("status", (v ?? "draft") as PropertyStatus)
                    }
                  >
                    <SelectTrigger id="status" className="w-44">
                      <SelectValue placeholder="Selecciona un estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" disabled={isPending} onClick={handleSave}>
                    {isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Guardar cambios
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={handleCancel}
                  >
                    <X className="size-4" />
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <EditorModeToggle active={editorMode} />
                  <PropertyModerationActions
                    propertyId={listing.id}
                    status={listing.status}
                  />
                  {listing.status !== "deleted" && (
                    <Button size="sm" onClick={handleStartEdit}>
                      <Pencil className="size-4" />
                      Editar
                    </Button>
                  )}
                </>
              )}
            </div>
            {error && (
              <p
                className="w-full text-sm font-medium text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
        )}

        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[1fr_320px]">
          <section className="min-w-0 space-y-8">
            {editing ? (
              <PhotoManager
                images={form.images}
                onChange={(updater) =>
                  setForm((prev) => ({
                    ...prev,
                    images: updater(prev.images),
                  }))
                }
              />
            ) : (
              gallery
            )}
            {editing ? (
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={6}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                />
              </div>
            ) : (
              listing.description && (
                <p className="whitespace-pre-line text-muted-foreground">
                  {listing.description}
                </p>
              )
            )}
            {map}
            {media}
            {viewToggle}
            {similar}
          </section>

          <aside className="min-w-0 space-y-4">
            {asideCtas}
            {editing ? contactCardEdit : contactCardStatic}
            {editing ? priceCardEdit : priceCardStatic}
            {editing ? detailsCardEdit : detailsCardStatic}
          </aside>
        </div>

        {editing && advancedSection}
      </main>

      {editing ? null : mobileCta}
    </div>
  );
}

function EditableField({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {label}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/** Format a 10-digit MX phone as "614 252 3883" for display. */
function formatPhoneDisplay(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return phone;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/**
 * Inline photo manager for the master user's edit mode: drag-to-reorder,
 * upload (dropzone + paste URL) and delete. Mirrors the wizard's StepMedia
 * behavior; removal only drops the URL from the array (storage object stays,
 * same as the wizard). The first image is the cover.
 */
function PhotoManager({
  images,
  onChange,
}: {
  images: string[];
  onChange: (updater: (prev: string[]) => string[]) => void;
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

  const remainingSlots = MAX_INLINE_IMAGES - images.length;

  const uploadFiles = (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.size > 0);
    if (list.length === 0) return;
    if (list.length > remainingSlots) {
      setUploadError(
        `Solo puedes agregar ${remainingSlots} imagen(es) más (límite ${MAX_INLINE_IMAGES}).`,
      );
      return;
    }
    setUploadError(null);
    startUploading(async () => {
      const compressed = await Promise.all(
        list.map(compressImageForUpload),
      );
      const formData = new FormData();
      for (const file of compressed) formData.append("images", file);
      const res = await uploadWizardImages(formData);
      if (!res.ok) {
        setUploadError(res.error);
        return;
      }
      onChange((prev) => [...prev, ...res.data.urls]);
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
    onChange((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const removeImage = (url: string) => {
    onChange((prev) => prev.filter((img) => img !== url));
  };

  const addPasteUrl = () => {
    const url = pasteUrl.trim();
    if (!url) return;
    if (remainingSlots <= 0) {
      setUploadError(
        `Has alcanzado el límite de ${MAX_INLINE_IMAGES} imágenes.`,
      );
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setUploadError("Pega una URL válida que empiece con http:// o https://");
      return;
    }
    setUploadError(null);
    onChange((prev) => [...prev, url]);
    setPasteUrl("");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Fotografías de la propiedad</Label>
          <span className="text-xs text-muted-foreground">
            La primera foto es la portada
          </span>
        </div>

        {images.length === 0 && !isUploading && (
          <p className="text-sm text-muted-foreground">
            Aún no hay fotografías. Sube imágenes o pega una URL.
          </p>
        )}

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
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30",
          )}
        >
          <UploadCloud className="size-7 text-muted-foreground" />
          <p className="text-sm font-medium">
            Arrastra imágenes aquí o haz clic para subir
          </p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WebP o GIF · máx. 10 MB · {remainingSlots} de{" "}
            {MAX_INLINE_IMAGES} disponibles
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
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

        {/* Sortable grid */}
        {images.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleReorder}
          >
            <SortableContext
              items={images}
              strategy={rectSortingStrategy}
            >
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((url, index) => (
                  <SortableInlineImage
                    key={url}
                    url={url}
                    index={index}
                    disabled={isUploading}
                    onRemove={() => removeImage(url)}
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
            <Label htmlFor="inline-image-url" className="text-xs">
              ¿Tienes una URL de imagen?
            </Label>
            <div className="flex items-center gap-2">
              <Link2 className="size-4 shrink-0 text-muted-foreground" />
              <Input
                id="inline-image-url"
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addPasteUrl}
          >
            Agregar
          </Button>
        </div>
      </div>
    </div>
  );
}

function SortableInlineImage({
  url,
  index,
  disabled,
  onRemove,
}: {
  url: string;
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
  } = useSortable({ id: url });

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
        src={url}
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
