import {
  parseInboundMessages,
  sendWhatsAppText,
  storeInboundMessage,
  verifyWebhookRequest,
  verifyWebhookSignature,
  type WhatsAppWebhookPayload,
} from "@/modules/whatsapp/server";

export const runtime = "nodejs";

/**
 * WhatsApp Business Cloud API inbound webhook.
 *
 * GET  — Meta's verification handshake: when `hub.mode=subscribe` and
 *        `hub.verify_token` matches WHATSAPP_WEBHOOK_VERIFY_TOKEN we echo
 *        `hub.challenge` back so Meta activates the subscription.
 * POST — Inbound messages. Meta retries for up to 7 days on non-2xx, so we
 *        always ack with 200 and persist (deduped by wa_message_id).
 *        Optionally sends an auto-reply when outbound credentials are set.
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
      { ok: false, error: "Invalid signature." },
      { status: 403 },
    );
  }

  let payload: WhatsAppWebhookPayload;
  try {
    const raw: unknown = JSON.parse(rawBody);
    if (!isRecord(raw)) {
      return Response.json({ ok: false, error: "Body must be a JSON object." }, { status: 400 });
    }
    payload = raw as WhatsAppWebhookPayload;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
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

  // Fire-and-forget auto-reply for simple booking intents when outbound
  // WhatsApp credentials are configured.
  const first = messages[0];
  if (first && hasBookingIntent(first.body)) {
    void autoReply(first);
  }

  return Response.json({ ok: true, data: stored }, { status: 200 });
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
