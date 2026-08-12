"use client";

import { useState } from "react";
import { Loader2, UserRound } from "lucide-react";

import { WhatsAppIcon } from "@/modules/chat/components/share-whatsapp-button";
import { useSiteUrl } from "@/modules/chat/components/use-site-url";
import {
  buildAdvisorLink,
  buildWhatsAppConsolidatedShareLink,
  type ShareProperty,
} from "@/modules/chat/share";
import type { ChatFilters } from "@/modules/chat/types";

type SendStatus =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "fallback"; url: string | null }
  | { kind: "error"; message: string };

/**
 * Action bar pinned below the chat input with three WhatsApp flows:
 *
 * 1. "Compartir por WhatsApp" — generic share of the consolidated results to
 *    any contact (visible once there is at least one result).
 * 2. "Manda los resultados a tu WhatsApp" — asks for the visitor's number and
 *    calls /api/chat/send-whatsapp, which delivers the results and deploys
 *    the search bot inside that WhatsApp conversation (wa.me fallback shown
 *    when the direct send is rejected).
 * 3. "Hablar con un asesor" — always visible; wa.me link to the human
 *    advisor's personal number (NEXT_PUBLIC_WHATSAPP_ADVISOR_PHONE).
 */
export function ChatActionsBar({
  results,
  filters,
}: {
  results: ShareProperty[];
  filters: ChatFilters | undefined;
}) {
  const siteUrl = useSiteUrl();
  const advisorPhone = (
    process.env.NEXT_PUBLIC_WHATSAPP_ADVISOR_PHONE ?? ""
  ).replace(/\D/g, "");
  const advisorHref = advisorPhone ? buildAdvisorLink(advisorPhone) : null;

  const [formOpen, setFormOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<SendStatus>({ kind: "idle" });

  const hasResults = results.length > 0;
  const shareHref = hasResults
    ? buildWhatsAppConsolidatedShareLink(results, siteUrl)
    : null;

  const sendToWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status.kind === "sending") return;
    setStatus({ kind: "sending" });

    try {
      const res = await fetch("/api/chat/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, results, filters }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        fallbackUrl?: string | null;
        error?: string;
      };

      if (!res.ok) {
        setStatus({
          kind: "error",
          message: data.error ?? "No se pudo enviar. Inténtalo de nuevo.",
        });
      } else if (data.ok) {
        setStatus({ kind: "sent" });
      } else {
        setStatus({ kind: "fallback", url: data.fallbackUrl ?? null });
      }
    } catch {
      setStatus({
        kind: "error",
        message: "No se pudo enviar. Inténtalo de nuevo.",
      });
    }
  };

  if (!hasResults && !advisorHref) return null;

  return (
    <div className="space-y-2 border-t border-border/60 px-3 py-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        {shareHref && (
          <a
            href={shareHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Compartir la vista consolidada de resultados por WhatsApp"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <WhatsAppIcon className="size-4" />
            Compartir resultados
          </a>
        )}
        {hasResults && (
          <button
            type="button"
            onClick={() => {
              setFormOpen((open) => !open);
              setStatus({ kind: "idle" });
            }}
            aria-expanded={formOpen}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-3 py-2 text-sm font-medium text-[#128C7E] transition-colors hover:bg-[#25D366]/20"
          >
            <WhatsAppIcon className="size-4" />
            Manda los resultados a tu WhatsApp
          </button>
        )}
        {advisorHref && (
          <a
            href={advisorHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Hablar con un asesor por WhatsApp"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <UserRound className="size-4" />
            Hablar con un asesor
          </a>
        )}
      </div>

      {formOpen && hasResults && (
        <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/40 p-3">
          {status.kind === "sent" ? (
            <p className="text-sm text-[#128C7E]" role="status">
              ¡Listo! ✅ Revisa tu WhatsApp — puedes seguir buscando ahí mismo,
              y si escribes &quot;asesor&quot; te atiendo personalmente.
            </p>
          ) : (
            <form onSubmit={sendToWhatsApp} className="flex items-center gap-2">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Tu WhatsApp (ej. 526141234567)"
                inputMode="tel"
                autoComplete="tel"
                maxLength={25}
                aria-label="Tu número de WhatsApp"
                className="h-9 min-w-0 flex-1 rounded-full border border-border bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <button
                type="submit"
                disabled={status.kind === "sending" || phone.trim().length < 10}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#128C7E] px-3 text-sm font-medium text-white transition-colors hover:bg-[#0f7a6d] disabled:pointer-events-none disabled:opacity-50"
              >
                {status.kind === "sending" && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                Enviar
              </button>
            </form>
          )}

          {status.kind === "error" && (
            <p className="text-sm text-destructive" role="alert">
              {status.message}
            </p>
          )}

          {status.kind === "fallback" && (
            <p className="text-sm text-muted-foreground">
              {status.url ? (
                <>
                  <a
                    href={status.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#128C7E] underline underline-offset-2"
                  >
                    Toca aquí para abrir tu WhatsApp
                  </a>{" "}
                  y el mensaje queda listo para enviarse
                </>
              ) : (
                "Inténtalo de nuevo en un momento."
              )}
            </p>
          )}

        </div>
      )}
    </div>
  );
}
