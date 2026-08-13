import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import type { Json } from "@/modules/lib/database.types";
import { env } from "@/modules/lib/env";
import type { Database } from "@/modules/lib/database.types";

/**
 * WhatsApp Business Cloud API integration.
 *
 * - `verifyWebhookRequest`: Meta's webhook verification handshake
 *   (hub.mode / hub.verify_token / hub.challenge).
 * - `parseInboundMessages`: typed parsing of Meta's message webhook payload.
 * - `storeInboundMessage`: persists an inbound message to `whatsapp_messages`
 *   via the service-role client (no user session at the webhook boundary).
 * - `sendWhatsAppText`: optional outbound reply through the Cloud API
 *   (requires WHATSAPP_GRAPH_TOKEN + WHATSAPP_PHONE_NUMBER_ID).
 *
 * Every function degrades gracefully when env keys are missing so the rest
 * of the platform keeps working without WhatsApp configured.
 */

// ── Types (mirror Meta's webhook payloads, no `any`) ─────────────────────────

export type WhatsAppWebhookPayload = {
  object?: string;
  entry?: WhatsAppWebhookEntry[];
};

export type WhatsAppWebhookEntry = {
  id?: string;
  changes?: WhatsAppWebhookChange[];
};

export type WhatsAppWebhookChange = {
  field?: string;
  value?: WhatsAppWebhookValue;
};

export type WhatsAppWebhookValue = {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppInboundMessage[];
};

export type WhatsAppContact = {
  profile?: { name?: string };
  wa_id?: string;
};

export type WhatsAppInboundMessage = {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; caption?: string; media?: { url?: string } };
  video?: { id?: string; mime_type?: string; caption?: string; media?: { url?: string } };
  audio?: { id?: string; mime_type?: string; media?: { url?: string } };
  interactive?: { type?: string; button_reply?: { title?: string } };
};

/** A normalized, validated inbound message ready for storage. */
export type NormalizedInboundMessage = {
  waMessageId: string;
  waId: string;
  profileName: string;
  phoneNumber: string;
  body: string;
  messageType: string;
  mediaType: string | null;
  mediaUrl: string | null;
  /** Cloud API media id — required to download the binary via Graph API. */
  mediaId: string | null;
  receivedAt: string;
  raw: Json;
};

// ── Verification handshake ──────────────────────────────────────────────────

/**
 * Parse a webhook verification request. Returns the challenge string when the
 * signature matches WHATSAPP_WEBHOOK_VERIFY_TOKEN, else null.
 */
export function verifyWebhookRequest(url: URL): string | null {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe") return null;
  if (!env.whatsappVerifyToken) return null;
  if (token !== env.whatsappVerifyToken) return null;
  return challenge;
}

/**
 * Verify Meta's `X-Hub-Signature-256` header for a webhook POST.
 *
 * Meta signs the raw request body with `sha256=<hex>` where the HMAC key is
 * the app secret (WHATSAPP_APP_SECRET). Comparing via `timingSafeEqual`
 * avoids timing side-channels. When no app secret is configured we accept the
 * payload so the webhook still works before credentials are set.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!env.whatsappAppSecret) return true;
  if (!signatureHeader) return false;

  const expected = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;

  const digest = createHmac("sha256", env.whatsappAppSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(digest, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Extract normalized inbound text messages from a webhook payload.
 * Returns an empty array for status-update payloads (no `messages` field).
 */
export function parseInboundMessages(
  payload: WhatsAppWebhookPayload,
): NormalizedInboundMessage[] {
  const messages: NormalizedInboundMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value = change.value;
      if (!value) continue;

      const contact = value.contacts?.[0];
      const waId = contact?.wa_id ?? "";
      const profileName = contact?.profile?.name ?? "";

      for (const msg of value.messages ?? []) {
        const from = msg.from ?? "";
        const waMessageId = msg.id ?? "";
        const messageType = msg.type ?? "text";
        const body =
          msg.text?.body ??
          msg.image?.caption ??
          msg.video?.caption ??
          msg.interactive?.button_reply?.title ??
          "";
        const mediaType =
          msg.image?.mime_type ??
          msg.video?.mime_type ??
          msg.audio?.mime_type ??
          null;
        const mediaUrl =
          msg.image?.media?.url ??
          msg.video?.media?.url ??
          msg.audio?.media?.url ??
          null;
        const mediaId =
          msg.image?.id ?? msg.video?.id ?? msg.audio?.id ?? null;
        const receivedAt = msg.timestamp
          ? new Date(Number(msg.timestamp) * 1000).toISOString()
          : new Date().toISOString();

        // Sender is always the prospect; the number that received the message
        // is the business line (metadata.phone_number_id).
        const phoneNumber = waId || from;

        messages.push({
          waMessageId,
          waId,
          profileName,
          phoneNumber,
          body,
          messageType,
          mediaType,
          mediaUrl,
          mediaId,
          receivedAt,
          raw: {
            message: msg,
            phone_number_id: value.metadata?.phone_number_id ?? "",
          } satisfies Json,
        });
      }
    }
  }

  return messages;
}

// ── Persistence (service role, no user session) ─────────────────────────────

let _serviceClient: ReturnType<typeof createClient<Database>> | null = null;

function serviceClient() {
  if (!_serviceClient) {
    _serviceClient = createClient<Database>(
      env.supabaseUrl,
      env.supabaseServiceRoleKey,
      { auth: { persistSession: false } },
    );
  }
  return _serviceClient;
}

export function whatsappInboundConfigured(): boolean {
  return Boolean(
    env.supabaseUrl &&
      env.supabaseServiceRoleKey &&
      env.whatsappVerifyToken,
  );
}

/**
 * Persist an inbound message to the inbox. Dedupes on Meta's message id so
 * webhook retries don't create duplicate rows. Returns the row id or null.
 */
export async function storeInboundMessage(
  msg: NormalizedInboundMessage,
): Promise<string | null> {
  if (!whatsappInboundConfigured()) return null;
  if (!msg.waMessageId) return null;

  try {
    const supabase = serviceClient();
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .upsert(
        {
          wa_message_id: msg.waMessageId,
          wa_id: msg.waId,
          profile_name: msg.profileName,
          phone_number: msg.phoneNumber,
          body: msg.body,
          message_type: msg.messageType,
          media_type: msg.mediaType,
          media_url: msg.mediaUrl,
          metadata: msg.raw,
          created_at: msg.receivedAt,
        },
        { onConflict: "wa_message_id" },
      )
      .select("id")
      .single();

    if (error || !data) return null;
    return data.id;
  } catch {
    return null;
  }
}

// ── Outbound reply (optional) ───────────────────────────────────────────────

export function whatsappOutboundConfigured(): boolean {
  return Boolean(
    env.whatsappGraphToken && env.whatsappPhoneNumberId,
  );
}

async function postWhatsAppMessage(
  to: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  if (!whatsappOutboundConfigured()) return null;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v23.0/${env.whatsappPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.whatsappGraphToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          ...payload,
        }),
      },
    );

    if (!res.ok) return null;
    const data = (await res.json()) as { messages?: { id?: string }[] };
    return data.messages?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Send a text message to a WhatsApp user via the Cloud API.
 * Returns the sent message id, or null on failure / missing config.
 */
export async function sendWhatsAppText(
  to: string,
  text: string,
): Promise<string | null> {
  return postWhatsAppMessage(to, {
    type: "text",
    text: { body: text.slice(0, 4096) },
  });
}

/**
 * Send an image message (photo card) via the Cloud API. The image URL must be
 * publicly reachable — Meta fetches it server-side. Caption is optional and
 * limited to 1024 chars. Only works inside the 24h customer-service window.
 */
export async function sendWhatsAppImage(
  to: string,
  imageUrl: string,
  caption?: string,
): Promise<string | null> {
  return postWhatsAppMessage(to, {
    type: "image",
    image: {
      link: imageUrl,
      ...(caption ? { caption: caption.slice(0, 1024) } : {}),
    },
  });
}

/**
 * Send an approved message template via the Cloud API. Required for the first
 * contact to a number outside the 24h customer-service window — Meta rejects
 * free-form text there. `bodyParams` fill the template's body variables in
 * order. Returns the sent message id, or null on failure / missing config.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  bodyParams: string[],
  languageCode = "es_MX",
  headerImageUrl?: string | null,
): Promise<string | null> {
  if (!templateName) return null;
  return postWhatsAppMessage(to, {
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        ...(headerImageUrl
          ? [
              {
                type: "header",
                parameters: [
                  { type: "image", image: { link: headerImageUrl } },
                ],
              },
            ]
          : []),
        {
          type: "body",
          parameters: bodyParams.map((text) => ({ type: "text", text })),
        },
      ],
    },
  });
}
