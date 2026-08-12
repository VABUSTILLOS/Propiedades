import { NextResponse } from "next/server";
import { z } from "zod";

import { chatFiltersSchema } from "@/modules/chat/types";
import { buildConsolidatedMessage } from "@/modules/chat/share";
import { env } from "@/modules/lib/env";
import { seedWhatsAppChatState } from "@/modules/whatsapp/chat-bot";
import {
  sendWhatsAppTemplate,
  sendWhatsAppText,
} from "@/modules/whatsapp/server";

export const runtime = "nodejs";

export const maxDuration = 30;

const sharePropertySchema = z.object({
  title: z.string().trim().min(1).max(200),
  colonia: z.string().trim().max(100),
  city: z.string().trim().max(100),
  price: z.number().min(0),
  currency: z.string().trim().max(10),
  slug: z.string().trim().min(1).max(200),
});

const sendWhatsAppRequestSchema = z.object({
  /**
   * Visitor's WhatsApp number. Any formatting accepted; normalized to digits
   * below and must end up 10–15 digits (E.164 without "+").
   */
  phone: z.string().trim().min(10, "Ingresa tu número de WhatsApp").max(25),
  results: z.array(sharePropertySchema).min(1).max(20),
  /** Active chat filters, seeded into the WhatsApp bot so it keeps context. */
  filters: chatFiltersSchema.optional(),
});

/**
 * POST /api/chat/send-whatsapp
 *
 * "Manda los resultados a tu WhatsApp": delivers the chat's consolidated
 * results directly to the visitor's number. Order of attempts:
 *   1. Free-form text (works inside the 24h customer-service window).
 *   2. Approved Meta template (WHATSAPP_RESULTS_TEMPLATE_NAME) for cold
 *      contacts outside the window.
 *   3. Otherwise returns a wa.me fallback URL for the client to show.
 *
 * On success the chat filters are seeded into whatsapp_chat_state so the
 * webhook bot (chat-bot.ts) continues the conversation with full context —
 * the chatbot is effectively deployed inside the visitor's WhatsApp thread.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;

  const parsed = sendWhatsAppRequestSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues[0]?.message ?? "Solicitud inválida";
    return NextResponse.json({ error: detail }, { status: 400 });
  }

  const { results, filters } = parsed.data;
  const phone = parsed.data.phone.replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 15) {
    return NextResponse.json(
      { error: "Revisa el número: usa formato internacional (ej. 526141234567)." },
      { status: 400 },
    );
  }

  const siteUrl = env.siteUrl;
  const message =
    buildConsolidatedMessage(results, siteUrl) +
    "\n\nResponde a este mensaje para seguir buscando aquí mismo 🔍 " +
    'Escribe "asesor" si prefieres que te atienda una persona.';

  // 1) Free-form text — only works when the 24h window is open.
  let sent = await sendWhatsAppText(phone, message);
  let via: "text" | "template" = "text";

  // 2) Cold contact: fall back to the approved template.
  if (!sent && env.whatsappResultsTemplateName) {
    sent = await sendWhatsAppTemplate(phone, env.whatsappResultsTemplateName, [
      message.slice(0, 1024),
    ]);
    via = "template";
  }

  // 3) Neither worked: hand the client a wa.me link to the business number
  //    so the visitor initiates the conversation themselves — that first
  //    message opens the 24h window and wakes the bot up.
  if (!sent) {
    const businessPhone = env.whatsappBusinessPhoneNumber.replace(/\D/g, "");
    const fallbackUrl = businessPhone
      ? `https://wa.me/${businessPhone}?text=${encodeURIComponent(message)}`
      : null;
    return NextResponse.json({ ok: false, fallbackUrl }, { status: 200 });
  }

  // Seed the bot's memory so follow-ups in WhatsApp keep the search context.
  if (filters) {
    await seedWhatsAppChatState(phone, filters);
  }

  return NextResponse.json({ ok: true, via }, { status: 200 });
}
