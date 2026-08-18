"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clipboard,
  Globe,
  Link2,
  Loader2,
  MapPin,
  Save,
  Sparkles,
} from "lucide-react";

import { createImportedDraft } from "@/modules/listings/actions";
import {
  PropertyLocationPicker,
  type LocationResult,
} from "@/modules/maps/components/property-location-picker";
import type { ImportedPropertyDraft } from "@/modules/importer/schemas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STEPS = [
  { label: "Leyendo la página…", icon: Link2 },
  { label: "Extrayendo datos con IA…", icon: Sparkles },
  { label: "Geolocalizando…", icon: MapPin },
];

const STEP_MS = 900;

const MANUAL_COPY_INSTRUCTIONS = `Abre el anuncio en tu navegador (con sesión iniciada si el sitio lo requiere, como Facebook Marketplace). Pulsa ⌘A (Mac) o Ctrl+A (Windows) para seleccionar todo el contenido del anuncio y pulsa ⌘C / Ctrl+C para copiarlo. Luego pégalo en el cuadro de abajo.`;

/**
 * Some portals (Facebook Marketplace, Vivanuncios, …) block server-side
 * scraping. For those, the user pastes the listing content copied from their
 * own browser and it is sent alongside the URL.
 */
const showManualPasteHelper = (value: string) => value.trim().length > 0;

/**
 * Universal Property Importer: paste any listing URL (Facebook Marketplace,
 * Inmuebles24, Mercado Libre, …) and get a pre-filled draft with a draggable
 * map pin, ready to save. Some portals block server-side scraping, so the
 * user can paste the listing content copied from their own browser and it is
 * sent alongside the URL.
 */
export function UniversalImporterClient() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [fbContent, setFbContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState<"idle" | "loading" | "error">("idle");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<ImportedPropertyDraft | null>(null);
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editTerreno, setEditTerreno] = useState("");
  const [editConst, setEditConst] = useState("");

  const [isSaving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const showPasteHelper = showManualPasteHelper(url);

  // Micro-animation: advance the loader step while the pipeline runs.
  useEffect(() => {
    if (phase !== "loading") return;
    const timer = window.setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [phase]);

  const copyInstructions = async () => {
    try {
      await navigator.clipboard.writeText(MANUAL_COPY_INSTRUCTIONS);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard unavailable — the text is already visible on screen.
    }
  };

  const importFromUrl = () => {
    const trimmed = url.trim();
    if (!trimmed || phase === "loading") return;

    setError(null);
    setPhase("loading");
    setStep(0);

    fetch("/api/properties/import-universal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: trimmed,
        ...(fbContent.trim() ? { content: fbContent } : {}),
      }),
    })
      .then(async (res) => {
        const json = (await res.json()) as {
          ok?: boolean;
          data?: ImportedPropertyDraft;
          error?: string;
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error ?? "No se pudo importar la propiedad.");
        }
        const d = json.data;
        setDraft(d);
        setEditTitle(d.title);
        setEditPrice(String(d.price));
        setEditTerreno(String(d.terreno_m2));
        setEditConst(String(d.construccion_m2));
        setLocation({
          lat: d.lat,
          lng: d.lng,
          address: d.address,
          colonia: d.colonia,
          city: d.city,
          state: d.state,
          zip_code: d.zip_code ?? undefined,
        });
        setPhase("idle");
        setDialogOpen(true);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Error de red al importar.");
        setPhase("error");
      });
  };

  const saveDraft = () => {
    if (!draft) return;
    startSaving(async () => {
      setSaveError(null);
      const res = await createImportedDraft({
        ...draft,
        title: editTitle.trim() || draft.title,
        price: Number(editPrice) || 0,
        terreno_m2: Number(editTerreno) || 0,
        construccion_m2: Number(editConst) || 0,
        address: location?.address ?? draft.address,
        colonia: location?.colonia ?? draft.colonia,
        city: location?.city ?? draft.city,
        state: location?.state ?? draft.state,
        zip_code: location?.zip_code ?? draft.zip_code,
        lat: location?.lat ?? draft.lat,
        lng: location?.lng ?? draft.lng,
      });
      if (!res.ok) {
        if (res.code === "AUTH_REQUIRED") {
          router.push("/sign-up?next=/import");
          return;
        }
        setSaveError(res.error);
        return;
      }
      setDialogOpen(false);
      setDraft(null);
      setUrl("");
      setFbContent("");
      router.push("/my-listings");
      router.refresh();
    });
  };

  return (
    <div>
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h2 className="font-semibold">
            Pegar cualquier link para importar propiedad en 3 segundos
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Facebook Marketplace, Inmuebles24, Mercado Libre, Propiedades.com,
          Vivanuncios, Century21 o cualquier web inmobiliaria.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") importFromUrl();
              }}
              placeholder="https://www.facebook.com/marketplace/…"
              className="w-full rounded-lg border bg-background py-2 pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>
          <Button onClick={importFromUrl} disabled={phase === "loading" || !url.trim()}>
            {phase === "loading" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {phase === "loading" ? "Importando…" : "Importar"}
          </Button>
        </div>

        <AnimatePresence>
          {showPasteHelper && phase === "idle" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-2">
                  <Globe className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        ¿El sitio bloquea la importación?
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={copyInstructions}
                      >
                        <Clipboard className="size-3.5" />
                        {copied ? "Copiado" : "Copiar instrucciones"}
                      </Button>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Algunos portales (Facebook Marketplace, Vivanuncios, …)
                      bloquean el acceso automático a los anuncios. Si la
                      importación falla, copia el contenido del anuncio desde
                      tu navegador y pégalo aquí para que la IA lea los datos
                      reales.
                    </p>
                    <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                      <li>
                        Abre el anuncio en tu navegador y selecciona todo el
                        contenido (⌘A / Ctrl+A) y cópialo (⌘C / Ctrl+C).
                      </li>
                      <li>Pega el contenido en el cuadro de abajo.</li>
                      <li>Pulsa Importar para extraer los datos con IA.</li>
                    </ol>
                    <textarea
                      value={fbContent}
                      onChange={(e) => setFbContent(e.target.value)}
                      placeholder="Pega aquí el contenido del anuncio…"
                      rows={5}
                      className="w-full rounded-lg border bg-background p-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      ¿La pegaste como texto plano? Funciona igual: la IA
                      extrae título, precio, metros y descripción desde lo que
                      pegues.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === "loading" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                <Loader2 className="size-5 animate-spin text-primary" />
                <div className="flex items-center gap-2">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={step}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="text-sm font-medium"
                    >
                      {STEPS[step]?.label}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === "error" && error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="mt-3 text-sm text-destructive"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vista previa de la propiedad importada</DialogTitle>
            <DialogDescription>
              Arrastra el pin en el mapa para fijar la ubicación exacta y
              ajusta los datos antes de guardar.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <PropertyLocationPicker
                initialLat={draft.lat}
                initialLng={draft.lng}
                onChange={setLocation}
                className="h-56"
              />

              {location?.address && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                  {location.address}
                  {location.colonia ? ` · ${location.colonia}` : ""}
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="importer-title">Título</Label>
                  <Input
                    id="importer-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="importer-price">Precio (MXN)</Label>
                  <Input
                    id="importer-price"
                    type="number"
                    min={0}
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="importer-terreno">Terreno (m²)</Label>
                    <Input
                      id="importer-terreno"
                      type="number"
                      min={0}
                      value={editTerreno}
                      onChange={(e) => setEditTerreno(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="importer-const">Construcción (m²)</Label>
                    <Input
                      id="importer-const"
                      type="number"
                      min={0}
                      value={editConst}
                      onChange={(e) => setEditConst(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {draft.bento_highlights.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {draft.bento_highlights.map((h) => (
                    <Badge key={h} variant="secondary" className="text-xs">
                      {h}
                    </Badge>
                  ))}
                </div>
              )}

              {saveError && (
                <p role="alert" className="text-sm text-destructive">
                  {saveError}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={isSaving}
              onClick={() => setDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={saveDraft} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Guardar propiedad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
