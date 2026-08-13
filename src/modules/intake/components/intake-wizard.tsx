"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Home,
  Loader2,
  Sparkles,
  TrendingDown,
} from "lucide-react";

import type {
  FieldDefDTO,
  IntakeFieldKey,
  IntakeStateDTO,
} from "@/modules/intake/schemas";
import { cn } from "@/lib/utils";

type CompletionData = {
  slug: string;
  opportunityScore: number | null;
  discountPct: number | null;
  benchmarkM2: number | null;
};

type HistoryEntry = { def: FieldDefDTO; value: string | number };

/**
 * Typeform-style slide wizard. The slide queue is driven exclusively by
 * `missing_fields` from Supabase: anything the AI already detected is shown
 * as a summary chip and never re-asked. Each answer is PATCHed
 * optimistically; the server response re-syncs the queue (e.g. answering
 * "tipo_propiedad: departamento" removes the terreno_m2 question).
 */
export function IntakeWizard({
  token,
  initialState,
}: {
  token: string;
  initialState: IntakeStateDTO;
}) {
  const [queue, setQueue] = useState<FieldDefDTO[]>(initialState.missing);
  const [answered, setAnswered] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [direction, setDirection] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CompletionData | null>(null);
  const completingRef = useRef(false);

  const total = answered + queue.length;
  const progress = total === 0 ? 1 : answered / total;

  const complete = useCallback(async () => {
    if (completingRef.current) return;
    completingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/intake/${token}/complete`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: CompletionData;
        error?: string;
      };
      if (!json.ok || !json.data) {
        setError(json.error ?? "No pudimos activar tu propiedad. Intenta de nuevo.");
        completingRef.current = false;
        return;
      }
      setDone(json.data);
    } catch {
      setError("Sin conexión. Verifica tu internet e intenta de nuevo.");
      completingRef.current = false;
    } finally {
      setBusy(false);
    }
  }, [token]);

  const answer = useCallback(
    async (field: IntakeFieldKey, value: string | number) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      setDirection(1);
      // Optimistic advance — the animation plays while the PATCH is in flight.
      setQueue((q) => q.slice(1));
      try {
        const res = await fetch(`/api/intake/${token}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field, value }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: IntakeStateDTO;
          error?: string;
        };
        if (!json.ok || !json.data) {
          // Roll the slide back so the user can retry.
          setQueue((q) => {
            const def = initialState.missing.find((d) => d.key === field);
            return def ? [def, ...q] : q;
          });
          setError(json.error ?? "Respuesta no válida. Revísala e intenta de nuevo.");
          return;
        }
        setAnswered((n) => n + 1);
        setHistory((h) => {
          const def = initialState.missing.find((d) => d.key === field);
          return def ? [...h, { def, value }] : h;
        });
        // Re-sync the remaining queue with server truth.
        setQueue((q) => {
          const serverMissing = new Set(json.data!.missing.map((d) => d.key));
          const rest = q.filter((s) => serverMissing.has(s.key));
          const known = new Set(rest.map((s) => s.key));
          const additions = json.data!.missing.filter((d) => !known.has(d.key));
          return [...rest, ...additions];
        });
        // Was that the last question?
        if (json.data.missing.length === 0) {
          void complete();
        }
      } catch {
        setQueue((q) => {
          const def = initialState.missing.find((d) => d.key === field);
          return def ? [def, ...q] : q;
        });
        setError("Sin conexión. Verifica tu internet e intenta de nuevo.");
      } finally {
        setBusy(false);
      }
    },
    [busy, complete, initialState.missing, token],
  );

  const goBack = useCallback(() => {
    const last = history[history.length - 1];
    if (!last || busy) return;
    setDirection(-1);
    setHistory((h) => h.slice(0, -1));
    setAnswered((n) => Math.max(0, n - 1));
    setQueue((q) => [last.def, ...q]);
    setError(null);
  }, [busy, history]);

  if (done) {
    return <SuccessScreen data={done} state={initialState} />;
  }

  const current = queue[0];

  return (
    <main className="relative flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="fixed inset-x-0 top-16 z-10 h-1 bg-muted">
        <motion.div
          className="h-full bg-primary"
          initial={false}
          animate={{ width: `${Math.round(progress * 100)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8 sm:py-12">
        {/* Prefilled summary — what the AI already knows, never re-asked */}
        {(initialState.prefilled.length > 0 || initialState.images.length > 0) && (
          <div className="mb-8">
            {initialState.images.length > 0 && (
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {initialState.images.slice(0, 6).map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt="Foto de la propiedad"
                    className="size-16 shrink-0 rounded-xl border object-cover"
                  />
                ))}
              </div>
            )}
            {initialState.prefilled.length > 0 && (
              <div className="rounded-2xl border bg-muted/40 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="size-3.5 text-primary" />
                  Detectamos de tu mensaje
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {initialState.prefilled.map((f) => (
                    <span
                      key={f.key}
                      className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs font-medium"
                    >
                      <Check className="size-3 text-emerald-600" />
                      {f.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Slide area */}
        <div className="relative flex flex-1 flex-col justify-center">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            {current ? (
              <motion.div
                key={current.key}
                custom={direction}
                initial={{ opacity: 0, x: direction * 64 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -64 }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
              >
                <SlideRenderer
                  key={current.key}
                  def={current}
                  busy={busy}
                  onSubmit={(value) => void answer(current.key, value)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="finishing"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-4 text-center"
              >
                {initialState.missing.length === 0 && !busy ? (
                  <>
                    <h1 className="text-3xl font-bold sm:text-4xl">
                      Todo está <em className="font-display italic">listo</em> 🎉
                    </h1>
                    <p className="max-w-md text-muted-foreground">
                      La IA ya detectó todos los datos de tu propiedad. Actívala
                      para calcular tu Score de Oportunidad y publicarla en el feed.
                    </p>
                    <button
                      type="button"
                      onClick={() => void complete()}
                      className="mt-2 inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
                    >
                      Activar mi propiedad
                      <ArrowRight className="size-5" />
                    </button>
                  </>
                ) : (
                  <>
                    <Loader2 className="size-8 animate-spin text-primary" />
                    <p className="text-lg font-medium">
                      Activando tu propiedad…
                    </p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error + navigation footer */}
        <div className="mt-8 flex min-h-12 items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={history.length === 0 || busy}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted",
              (history.length === 0 || busy) && "invisible",
            )}
          >
            <ArrowLeft className="size-4" />
            Atrás
          </button>
          <p className="text-xs text-muted-foreground">
            {total > 0
              ? `Pregunta ${Math.min(answered + 1, total)} de ${total}`
              : ""}
          </p>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive"
          >
            {error}
          </motion.p>
        )}
      </div>
    </main>
  );
}

// ── Slide renderers ───────────────────────────────────────────────────────────

function SlideRenderer({
  def,
  busy,
  onSubmit,
}: {
  def: FieldDefDTO;
  busy: boolean;
  onSubmit: (value: string | number) => void;
}) {
  if (def.input === "quick-select" && def.options) {
    return <QuickSelectSlide def={def} busy={busy} onSubmit={onSubmit} />;
  }
  if (def.input === "number") {
    return <NumberSlide def={def} busy={busy} onSubmit={onSubmit} />;
  }
  return <TextSlide def={def} busy={busy} onSubmit={onSubmit} />;
}

function SlideHeader({
  def,
  stepHint,
}: {
  def: FieldDefDTO;
  stepHint?: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        {def.question}
      </h1>
      {def.helper && (
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          {def.helper}
        </p>
      )}
      {stepHint && (
        <p className="mt-1 text-sm text-muted-foreground">{stepHint}</p>
      )}
    </div>
  );
}

/** Giant numeric input with unit and optional AI estimate chip. */
function NumberSlide({
  def,
  busy,
  onSubmit,
}: {
  def: FieldDefDTO;
  busy: boolean;
  onSubmit: (value: number) => void;
}) {
  const [raw, setRaw] = useState("");
  const value = Number(raw.replace(/,/g, ""));
  const valid = raw.trim() !== "" && Number.isFinite(value) && value > 0;
  const suggestion = typeof def.suggestion === "number" ? def.suggestion : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !busy) onSubmit(value);
      }}
    >
      <SlideHeader def={def} stepHint="Presiona Enter para continuar ↵" />
      <div className="flex items-baseline gap-3 border-b-2 border-foreground/20 pb-3 transition-colors focus-within:border-primary">
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          value={raw}
          onChange={(e) => setRaw(e.target.value.replace(/[^\d.,]/g, ""))}
          placeholder="0"
          aria-label={def.question}
          className="w-full bg-transparent text-5xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/30 sm:text-6xl"
        />
        {def.unit && (
          <span className="shrink-0 text-2xl font-semibold text-muted-foreground">
            {def.unit}
          </span>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {suggestion !== null && (
          <button
            type="button"
            onClick={() => !busy && onSubmit(suggestion)}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            <Sparkles className="size-4" />
            Usar estimado: {suggestion.toLocaleString("es-MX")} {def.unit}
          </button>
        )}
        <button
          type="submit"
          disabled={!valid || busy}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow transition enabled:hover:opacity-90 disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Continuar
        </button>
      </div>
    </form>
  );
}

/** Large tappable chips; selecting one auto-advances. */
function QuickSelectSlide({
  def,
  busy,
  onSubmit,
}: {
  def: FieldDefDTO;
  busy: boolean;
  onSubmit: (value: string | number) => void;
}) {
  return (
    <div>
      <SlideHeader def={def} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {def.options!.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            disabled={busy}
            onClick={() => onSubmit(opt.value)}
            className="flex h-16 items-center justify-center gap-2 rounded-2xl border-2 bg-card text-lg font-bold shadow-sm transition hover:border-primary hover:bg-primary/5 hover:text-primary active:scale-[0.97] disabled:opacity-50 sm:h-20 sm:text-xl"
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              opt.label
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Free text (e.g. colonia), with optional AI suggestion chip. */
function TextSlide({
  def,
  busy,
  onSubmit,
}: {
  def: FieldDefDTO;
  busy: boolean;
  onSubmit: (value: string) => void;
}) {
  const [raw, setRaw] = useState("");
  const valid = raw.trim().length >= 2;
  const suggestion = typeof def.suggestion === "string" ? def.suggestion : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !busy) onSubmit(raw.trim());
      }}
    >
      <SlideHeader def={def} stepHint="Presiona Enter para continuar ↵" />
      <input
        type="text"
        autoFocus
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Escribe aquí…"
        aria-label={def.question}
        className="w-full border-b-2 border-foreground/20 bg-transparent pb-3 text-4xl font-bold tracking-tight outline-none transition-colors placeholder:text-muted-foreground/30 focus:border-primary sm:text-5xl"
      />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {suggestion !== null && (
          <button
            type="button"
            onClick={() => !busy && onSubmit(suggestion)}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            <Sparkles className="size-4" />
            {suggestion}
          </button>
        )}
        <button
          type="submit"
          disabled={!valid || busy}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow transition enabled:hover:opacity-90 disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Continuar
        </button>
      </div>
    </form>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen({
  data,
  state,
}: {
  data: CompletionData;
  state: IntakeStateDTO;
}) {
  const colonia = useMemo(
    () =>
      state.prefilled.find((f) => f.key === "colonia")?.label ??
      state.colonia ??
      "tu colonia",
    [state],
  );

  return (
    <main className="flex min-h-[calc(100svh-4rem)] items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        className="w-full max-w-lg rounded-3xl border bg-card p-8 text-center shadow-lg sm:p-10"
      >
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 16 }}
          className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"
        >
          <Home className="size-8" />
        </motion.span>

        <h1 className="text-2xl font-bold sm:text-3xl">
          ¡Tu propiedad está <em className="font-display italic">activa</em>! 🎉
        </h1>
        <p className="mt-2 text-muted-foreground">
          Ya aparece en el feed público de propiedades-brown.
        </p>

        {data.opportunityScore !== null && (
          <div className="mt-6 rounded-2xl border bg-muted/40 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Score de Oportunidad
            </p>
            <p className="mt-1 font-display text-6xl font-bold text-primary">
              {data.opportunityScore}
              <span className="text-2xl text-muted-foreground">/100</span>
            </p>
            {data.discountPct !== null && data.discountPct > 0 && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                <TrendingDown className="size-4" />
                {data.discountPct.toFixed(1)}% debajo del promedio de {colonia}
              </p>
            )}
            {data.benchmarkM2 !== null && (
              <p className="mt-2 text-xs text-muted-foreground">
                Benchmark: ${Math.round(data.benchmarkM2).toLocaleString("es-MX")} MXN/m²
                de construcción en la zona
              </p>
            )}
          </div>
        )}

        <Link
          href={`/property/${data.slug}`}
          className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
        >
          Ver mi propiedad publicada
          <ArrowRight className="size-5" />
        </Link>
      </motion.div>
    </main>
  );
}
