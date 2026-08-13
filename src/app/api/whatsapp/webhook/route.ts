import { after } from "next/server";

import {
  parseInboundMessages,
  sendWhatsAppText,
  storeInboundMessage,
  verifyWebhookRequest,
  verifyWebhookSignature,
  whatsappOutboundConfigured,
  type NormalizedInboundMessage,
  type WhatsAppWebhookPayload,
} from "@/modules/whatsapp/server";
import { ingestInboundImages } from "@/modules/whatsapp/media";
import {
  cleanupExpiredChatStates,
  replyWhatsAppInbound,
} from "@/modules/whatsapp/chat-bot";
import {
  appendToIntakeDraft,
  createIntakeDraft,
  findOpenIntake,
  getIntakeState,
  runExtraction,
} from "@/modules/intake/server";
import {
  FIELD_REGISTRY,
  type IntakeFieldKey,
  type IntakeStateDTO,
} from "@/modules/intake/schemas";
import { env } from "@/modules/lib/env";

export const runtime = "nodejs";
// Photos + DeepSeek extraction need more than the default function budget.
export const maxDuration = 60;

/**
 * WhatsApp Business Cloud API inbound webhook.
 *
 * GET  — Meta's verification handshake: when `hub.mode=subscribe` and
 *        `hub.verify_token` matches WHATSAPP_WEBHOOK_VERIFY_TOKEN we echo
 *        `hub.challenge` back so Meta activates the subscription.
 * POST — Inbound messages. Meta retries for up to 7 days on non-2xx, so we
 *        always ack with 200 and persist (deduped by wa_message_id).
 *
 * Two flows share this endpoint:
 *  - Sell intent ("Sube tu propiedad"): photos/text create an intake draft,
 *    DeepSeek extracts structured data in `after()` and the bot replies with
 *    the unique /publicar/[token] wizard link.
 *  - Everything else: the existing search/booking chat bot.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const challenge = verifyWebhookRequest(url);

  if (challenge === null) {
    return new Response("Verificación fallida", { status: 403 });
  }

  // Meta expects the challenge echoed back verbatim as the response body.
  return new Response(challenge, { status: 200 });
}

export async function POST(req: Request): Promise<Response> {
  // Read the raw body first so we can verify Meta's X-Hub-Signature-256 over
  // the exact bytes we parse. Skips verification when WHATSAPP_APP_SECRET is
  // not configured (feature degrades gracefully).
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return Response.json(
      { ok: false, error: "Firma no válida." },
      { status: 403 },
    );
  }

  let payload: WhatsAppWebhookPayload;
  try {
    const raw: unknown = JSON.parse(rawBody);
    if (!isRecord(raw)) {
      return Response.json({ ok: false, error: "El cuerpo debe ser un objeto JSON." }, { status: 400 });
    }
    payload = raw as WhatsAppWebhookPayload;
  } catch {
    return Response.json({ ok: false, error: "Cuerpo JSON no válido." }, { status: 400 });
  }

  // Only handle WhatsApp business account notifications; other objects
  // (e.g. instagram) must still be acked so Meta stops retrying.
  if (payload.object !== "whatsapp_business_account") {
    return Response.json({ ok: true }, { status: 200 });
  }

  const messages = parseInboundMessages(payload);

  // Persist synchronously but never let a DB hiccup trigger Meta retries —
  // the dedupe on wa_message_id makes retries safe.
  const stored: { id: string | null; from: string; body: string }[] = [];
  for (const msg of messages) {
    const id = await storeInboundMessage(msg);
    stored.push({ id, from: msg.waId, body: msg.body });
  }

  const first = messages[0];
  if (first && whatsappOutboundConfigured()) {
    if (isAudioOnly(messages)) {
      // v1: no transcription yet — ask the seller to type it out.
      void sendWhatsAppText(
        first.waId,
        "¡Gracias! 🎙️ Por ahora solo puedo leer mensajes de texto. " +
          "¿Me describes tu propiedad escrito? (qué es, colonia, precio y recámaras)",
      );
    } else if (hasSellIntent(messages)) {
      // Ack Meta immediately; the intake pipeline runs after the response.
      after(() => runIntakePipeline(messages));
    } else if (env.whatsappChatEnabled) {
      void replyWhatsAppInbound(first.waId, first.body).then(() =>
        cleanupExpiredChatStates(),
      );
    } else if (hasBookingIntent(first.body)) {
      void autoReply(first);
    }
  }

  return Response.json({ ok: true, data: stored }, { status: 200 });
}

// ── "Sube tu propiedad" intake pipeline ───────────────────────────────────────

/** Voice notes / audio without any text — transcription is a phase-2 feature. */
function isAudioOnly(messages: NormalizedInboundMessage[]): boolean {
  return (
    messages.length > 0 &&
    messages.every((m) => m.messageType === "audio" && !m.body.trim())
  );
}

/**
 * Sell intent beats the search chat bot: explicit sell verbs, or property
 * photos (buyers essentially never send images; sellers always do).
 */
function hasSellIntent(messages: NormalizedInboundMessage[]): boolean {
  const SELL_KEYWORDS = [
    "vendo",
    "vender",
    "venta de",
    "quiero vender",
    "publicar mi",
    "anunciar mi",
    "pongo en venta",
    "mi casa en",
    "pido ",
  ];
  return messages.some((m) => {
    if (m.messageType === "image") return true;
    const normalized = m.body.toLowerCase();
    return SELL_KEYWORDS.some((k) => normalized.includes(k));
  });
}

/**
 * Full background intake: create-or-append the draft, copy photos to
 * Supabase Storage, run DeepSeek extraction and reply with the wizard link.
 * Runs inside `after()` — the webhook already acked Meta.
 */
async function runIntakePipeline(
  messages: NormalizedInboundMessage[],
): Promise<void> {
  const first = messages[0];
  if (!first) return;
  const text = messages
    .map((m) => m.body.trim())
    .filter(Boolean)
    .join("\n");

  try {
    let draft = await findOpenIntake(first.waId);

    if (draft) {
      const imageUrls = await ingestInboundImages(draft.id, messages);
      await appendToIntakeDraft(draft.id, { text, imageUrls });
      await runExtraction(draft.id);
    } else {
      draft = await createIntakeDraft({
        waId: first.waId,
        profileName: first.profileName,
        text,
        imageUrls: [],
      });
      if (!draft) return;
      const imageUrls = await ingestInboundImages(draft.id, messages);
      if (imageUrls.length > 0) {
        await appendToIntakeDraft(draft.id, { imageUrls });
      }
      await runExtraction(draft.id);
    }

    await sendIntakeSummary(first.waId, draft.token);
  } catch (error) {
    console.error("[intake] pipeline failed:", error);
    await sendWhatsAppText(
      first.waId,
      "Recibí tu información, pero tuve un problema procesándola. " +
        "Un asesor te contactará en breve. 🙏",
    );
  }
}

/** Post-extraction WhatsApp reply with detected data + unique wizard link. */
async function sendIntakeSummary(waId: string, token: string): Promise<void> {
  const link = `${env.siteUrl}/publicar/${token}`;
  const result = await getIntakeState(token);

  if (!result.ok) {
    await sendWhatsAppText(
      waId,
      `¡Recibí tu propiedad! 🏡 Para terminar de activarla, da clic aquí: ${link}`,
    );
    return;
  }

  const detected = summarizePrefilled(result.state);
  const remaining = result.state.missing.length;

  const body = detected
    ? `¡Recibí tu propiedad! 🏡 Detecté: ${detected}.\n` +
      (remaining > 0
        ? `Solo falta${remaining === 1 ? "" : "n"} ${remaining} dato${remaining === 1 ? "" : "s"} para activarla y calcular tu Score de Oportunidad. `
        : "Todo listo para activarla y calcular tu Score de Oportunidad. ") +
      `Da clic aquí: ${link}`
    : `¡Recibí tu información! 📸 Para activar tu propiedad y calcular tu Score de Oportunidad, completa los datos aquí: ${link}`;

  await sendWhatsAppText(waId, body);
}

function summarizePrefilled(state: IntakeStateDTO): string {
  const interesting: IntakeFieldKey[] = [
    "tipo_propiedad",
    "colonia",
    "precio",
    "recamaras",
  ];
  return state.prefilled
    .filter((f) => interesting.includes(f.key))
    .map((f) => f.label || FIELD_REGISTRY[f.key].formatValue(f.value))
    .filter(Boolean)
    .join(" · ");
}

async function autoReply(msg: {
  waId: string;
  body: string;
}): Promise<void> {
  await sendWhatsAppText(
    msg.waId,
    "¡Hola! 👋 Recibimos tu mensaje. Un asesor te atenderá en breve. " +
      "Si quieres agendar una visita, dime qué días te quedan bien.",
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
    "precio",
    "disponible",
  ];
  return keywords.some((k) => normalized.includes(k));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
