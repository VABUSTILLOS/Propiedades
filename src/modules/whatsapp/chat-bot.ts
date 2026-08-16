import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { runChatSearch } from "@/modules/chat/search";
import type { ChatFilters, ChatResponse, ChatResult } from "@/modules/chat/types";
import { getSearchableCities } from "@/modules/search/queries";
import { env } from "@/modules/lib/env";
import { formatMoney } from "@/modules/lib/real-estate";
import { buildAdvisorLink } from "@/modules/chat/share";
import { sendWhatsAppText } from "@/modules/whatsapp/server";

/**
 * WhatsApp chat bot.
 *
 * Answers inbound WhatsApp messages with the *same* search engine as the site
 * chatbot (`runChatSearch`): interpret → merge with previous filters → search
 * → relax → reply. Per-contact filters are kept in `whatsapp_chat_state` so
 * follow-ups like "y más baratas" keep the context of the first message.
 *
 * The 24h window stays open because replies are triggered by user messages
 * (no templates needed for search answers). Replies are plain text capped at
 * the 1024-char Cloud API limit.
 */

const MAX_RESULTS_IN_TEXT = 4;
const CHAT_STATE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Minimal schema for whatsapp_chat_state (created in migration 020, not yet
 * in the generated database.types.ts). */
type ChatStateDatabase = {
  public: {
    Tables: {
      whatsapp_chat_state: {
        Row: { wa_id: string; filters: unknown; updated_at: string };
        Insert: { wa_id: string; filters?: unknown; updated_at?: string };
        Update: Partial<{ wa_id: string; filters: unknown; updated_at: string }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

let _stateClient: SupabaseClient<ChatStateDatabase> | null = null;

/** Service-role client for whatsapp_chat_state (not in generated types). */
function stateClient() {
  if (!_stateClient) {
    _stateClient = createClient<ChatStateDatabase>(
      env.supabaseUrl,
      env.supabaseServiceRoleKey,
      { auth: { persistSession: false } },
    );
  }
  return _stateClient;
}

// ── Chat memory (whatsapp_chat_state) ───────────────────────────────────────

async function getChatState(waId: string): Promise<ChatFilters | undefined> {
  if (!env.supabaseServiceRoleKey) return undefined;
  try {
    const { data } = await stateClient()
      .from("whatsapp_chat_state")
      .select("filters")
      .eq("wa_id", waId)
      .maybeSingle();
    if (!data?.filters || typeof data.filters !== "object") return undefined;
    return data.filters as ChatFilters;
  } catch {
    return undefined;
  }
}

/**
 * Seed (or update) the per-contact filters from outside the webhook — e.g.
 * after /api/chat/send-whatsapp delivers the site results to a visitor's
 * WhatsApp, so the bot continues that conversation with the same context.
 */
export async function seedWhatsAppChatState(
  waId: string,
  filters: ChatFilters,
): Promise<void> {
  return saveChatState(waId, filters);
}

async function saveChatState(waId: string, filters: ChatFilters): Promise<void> {
  if (!env.supabaseServiceRoleKey) return;
  try {
    await stateClient()
      .from("whatsapp_chat_state")
      .upsert(
        {
          wa_id: waId,
          filters: filters as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "wa_id" },
      );
  } catch {
    // State is best-effort; a failed write must never break the reply.
  }
}

/** Delete a contact's chat state (e.g. "nueva búsqueda" reset). Best-effort. */
export async function clearChatState(waId: string): Promise<void> {
  if (!env.supabaseServiceRoleKey) return;
  try {
    await stateClient().from("whatsapp_chat_state").delete().eq("wa_id", waId);
  } catch {
    // Best-effort.
  }
}

/** Delete chat state rows older than 7 days. Fire-and-forget, best-effort. */
export async function cleanupExpiredChatStates(): Promise<void> {
  if (!env.supabaseServiceRoleKey) return;
  try {
    const cutoff = new Date(Date.now() - CHAT_STATE_TTL_MS).toISOString();
    await stateClient()
      .from("whatsapp_chat_state")
      .delete()
      .lt("updated_at", cutoff);
  } catch {
    // Best-effort.
  }
}

// ── Reply formatting ─────────────────────────────────────────────────────────

function formatPrice(price: number, currency: string): string {
  return formatMoney(price, (currency || "MXN").toUpperCase());
}

function formatResultsText(results: ChatResult[]): string {
  if (results.length === 0) return "";
  const limited = results.slice(0, MAX_RESULTS_IN_TEXT);
  const siteUrl = env.siteUrl;
  const lines = limited.map((r, i) => {
    const place = [r.colonia, r.city].filter(Boolean).join(", ");
    const link = siteUrl ? `${siteUrl}/property/${r.slug}` : "";
    return `${i + 1}. ${r.title} · ${place} · ${formatPrice(r.price, r.currency)}${link ? `\n   ${link}` : ""}`;
  });
  const noun = results.length === 1 ? "propiedad" : "propiedades";
  const header = `Encontré ${results.length} ${noun}:`;
  const overflow =
    results.length > limited.length
      ? `\n\n(+${results.length - limited.length} más en el sitio)`
      : "";
  return `${header}\n\n${lines.join("\n")}${overflow}`;
}

function buildHelpMenu(justReset = false): string {
  return (
    (justReset ? "¡Listo! Empecé una búsqueda nueva. 👋\n\n" : "¡Hola! 👋 Soy el asistente de Propiedades. Busco casas, departamentos y " +
    "terrenos de tu zona.\n\nPrueba con:\n") +
    '• "casas en renta en Guadalajara"\n' +
    '• "departamento en Condesa, 2 recámaras"\n' +
    '• "terrenos de 500 m2 en Mérida"\n' +
    '• "lo más barato en renta"\n\n' +
    'Puedes refinar tu búsqueda con frases como "y más baratas" o ' +
    '"con alberca", y escribir "ver alternativas" si no hay resultados ' +
    "exactos. Si quieres empezar de cero, escribe \"nueva búsqueda\".\n\n" +
    'Escribe "asesor" en cualquier momento si prefieres que te atienda una ' +
    "persona.\n\n¿En qué te ayudo? 😊"
  );
}

function buildAdvisorMessage(): string {
  const advisorLink = env.whatsappAdvisorPhone
    ? buildAdvisorLink(env.whatsappAdvisorPhone)
    : "";
  return (
    "¡Recibido! 👋 " +
    (advisorLink
      ? `Toca aquí y te atiendo personalmente en mi WhatsApp:\n${advisorLink}\n\n`
      : "Un asesor te atenderá en breve. ") +
    "Mientras tanto, dime qué tipo de propiedad buscas y te muestro " +
    "opciones disponibles aquí mismo."
  );
}

function isGreeting(body: string): boolean {
  const normalized = body.toLowerCase().trim();
  if (normalized.length > 30) return false;
  return /^(hola|holi|hello|hi|buenas|buenos d[ií]as|buenas tardes|buenas noches|ayuda|help|men[uú]|qu[eé] es esto|que es esto|empezar|inicio)\b/.test(
    normalized,
  );
}

/** True when the user wants to clear the current filters and start over. */
function isResetCommand(body: string): boolean {
  const normalized = body.toLowerCase().trim();
  return /^(?:nueva\s+b[úu]squeda|reiniciar(?:.*)?|empezar\s+de\s+nuevo|limpiar|reset)\b|nueva\s+b[úu]squeda$/.test(
    normalized,
  );
}

function hasBookingIntent(body: string): boolean {
  const normalized = body.toLowerCase();
  const keywords = [
    "visita",
    "agendar",
    "cita",
    "tour",
    "me interesa",
    "asesor",
    "contactar",
    "hablar con alguien",
    "agente",
    "humano",
    "persona",
    "dueño",
  ];
  return keywords.some((k) => normalized.includes(k));
}

// ── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Handle one inbound WhatsApp text. Returns the message to send back, or null
 * when nothing should be sent. Greetings get the help menu, booking intents
 * get the human-advisor handoff, anything else runs the real property search.
 * Asking for "alternativas" opts into the relaxed search mode.
 */
export async function handleWhatsAppInbound(
  waId: string,
  body: string,
): Promise<string | null> {
  const message = body.trim();
  if (!message) return null;

  // Reset first: "nueva búsqueda" clears the remembered filters so the next
  // message starts from scratch. Don't let it fall through to the search.
  if (isResetCommand(message)) {
    await clearChatState(waId);
    return buildHelpMenu(true);
  }

  // Booking intents first: "hola, quiero agendar una visita" starts like a
  // greeting but must reach the human advisor, not the help menu.
  if (hasBookingIntent(message)) return buildAdvisorMessage();
  if (isGreeting(message)) return buildHelpMenu();

  const wantsAlternatives = /(?:ver|mu[eé]strame|dame|quiero)\s+alternativas?\b|alternativas?\s*$/i.test(
    message,
  );

  const previous = await getChatState(waId);
  const cities = await getSearchableCities().catch(() => []);

  let response: ChatResponse;
  try {
    response = await runChatSearch(message, cities, previous, {
      mode: wantsAlternatives ? "alternatives" : "strict",
    });
  } catch {
    // Never let a search failure block the reply.
    return buildHelpMenu();
  }

  await saveChatState(waId, response.filters);

  const resultsText = formatResultsText(response.results);
  let full = resultsText ? `${response.reply}\n\n${resultsText}` : response.reply;

  // No exact matches: suggest relaxing the search or talking to a human
  // instead of leaving the user with a dead end.
  if (response.matched === false && !response.relaxed && !wantsAlternatives) {
    full += "\n\n¿Quieres que busque alternativas similares? " +
      "Escribe \"ver alternativas\" o pide que te atienda un asesor.";
  }

  return full.slice(0, 1024);
}

/** Convenience wrapper: run the bot and send the reply via the Cloud API. */
export async function replyWhatsAppInbound(waId: string, body: string): Promise<string | null> {
  const text = await handleWhatsAppInbound(waId, body);
  if (!text) return null;
  return sendWhatsAppText(waId, text);
}
