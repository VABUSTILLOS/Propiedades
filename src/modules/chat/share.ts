import type { ChatFilters, ChatResult } from "@/modules/chat/types";

/** Business WhatsApp number in international format (no "+"), per product spec. */
export const WHATSAPP_CONTACT_NUMBER = "526141047021";

/**
 * Builds a `wa.me` link to the business WhatsApp with a pre-filled message
 * asking about a specific property.
 */
export function buildWhatsAppInquiryLink(property: {
  title: string;
  colonia?: string | null;
  city?: string | null;
}): string {
  const location = [property.colonia, property.city].filter(Boolean).join(", ");
  const message = `Hola, me interesa la propiedad "${property.title}"${
    location ? ` en ${location}` : ""
  }. ¿Sigue disponible?`;
  return `https://wa.me/${WHATSAPP_CONTACT_NUMBER}?text=${encodeURIComponent(message)}`;
}

/**
 * Builds a prefabricated WhatsApp share URL for a property.
 * Message format (per product spec):
 *   ¡Mira esta oportunidad! {title}. {colonia}, {city} por ${price} {currency}.
 *   Más info: {siteUrl}/property/{slug}
 */

export function buildWhatsAppShareLink(
  property: Pick<ChatResult, "title" | "colonia" | "city" | "price" | "currency" | "slug">,
  siteUrl: string,
): string {
  const location = [property.colonia, property.city].filter(Boolean).join(", ");
  const message =
    `¡Mira esta oportunidad! ${property.title}. ` +
    `${location} por $${property.price.toLocaleString("es-MX")} ${property.currency ?? "MXN"}. ` +
    `Más info: ${siteUrl}/property/${property.slug}`;

  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

const MAX_HANDOFF_PROPERTIES = 5;

/** Inputs for building a "continue on WhatsApp" handoff link. */
export interface WhatsAppHandoffInput {
  lastMessage: string;
  results: ShareProperty[];
  filters?: ChatFilters;
  siteUrl: string;
  businessPhone: string;
}

/** Short human label for one chat filter. Returns "" when not set. */
function describeFilter(
  label: string,
  value: string | number | boolean | undefined | null,
): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "boolean") return value ? label : "";
  return `${label}: ${value}`;
}

/**
 * Builds a `wa.me` handoff link so a visitor can continue the property search
 * on WhatsApp. The message carries the last chat message, the active filters
 * and the top results found so far, so the WhatsApp bot (chat-bot.ts) can
 * keep the context with "y más baratas" style follow-ups.
 */
export function buildWhatsAppHandoffLink(input: WhatsAppHandoffInput): string {
  const { lastMessage, results, filters, siteUrl, businessPhone } = input;
  const phone = businessPhone.replace(/\D/g, "");

  const filtersSummary = filters
    ? [
        filters.type,
        describeFilter("ciudad", filters.city),
        describeFilter("colonia", filters.colonia),
        describeFilter("min $", filters.minPrice),
        describeFilter("max $", filters.maxPrice),
        describeFilter("mín m2", filters.minM2),
        describeFilter("máx m2", filters.maxM2),
        filters.minBedrooms ? `mín ${filters.minBedrooms} rec` : "",
        filters.isLand ? "terrenos" : "",
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const shown = results.slice(0, MAX_HANDOFF_PROPERTIES);
  const hidden = results.length - shown.length;

  const lines = shown.map((p, i) => {
    const location = [p.colonia, p.city].filter(Boolean).join(", ");
    return (
      `${i + 1}. ${p.title} · ${location} · ` +
      `$${p.price.toLocaleString("es-MX")} ${p.currency ?? "MXN"} ` +
      `- ${siteUrl}/property/${p.slug}`
    );
  });

  let message = `Hola 👋 continúo mi búsqueda de propiedades.\n`;
  message += `Buscaba: ${lastMessage.trim()}\n`;
  if (filtersSummary) message += `Filtros: ${filtersSummary}\n`;
  if (lines.length > 0) {
    message += `\nOpciones que encontré:\n${lines.join("\n")}`;
    if (hidden > 0) {
      message += `\n(+${hidden} más)`;
    }
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
export type ShareProperty = Pick<
  ChatResult,
  "title" | "colonia" | "city" | "price" | "currency" | "slug"
>;

const MAX_CONSOLIDATED_PROPERTIES = 20;

/**
 * Builds a prefabricated WhatsApp share URL for many properties at once.
 * Message format (one numbered line per property):
 *   ¡Mira estas oportunidades! (N)
 *   1. {title}. {colonia}, {city} por $X MXN.
 *      Más info: {siteUrl}/property/{slug}
 * 2. ...
 *
 * The list is capped so the resulting URL stays within WhatsApp's practical
 * limits; extra properties are summarized with a link back to /favorites.
 */
/**
 * Builds the consolidated results message body (shared by the generic share
 * link and the server-side direct send in /api/chat/send-whatsapp).
 */
export function buildConsolidatedMessage(
  properties: ShareProperty[],
  siteUrl: string,
): string {
  const shown = properties.slice(0, MAX_CONSOLIDATED_PROPERTIES);
  const hidden = properties.length - shown.length;

  const lines = shown.map((property, index) => {
    const location = [property.colonia, property.city].filter(Boolean).join(", ");
    return (
      `${index + 1}. ${property.title}. ` +
      `${location} por $${property.price.toLocaleString("es-MX")} ` +
      `${property.currency ?? "MXN"}.\n` +
      `   Más info: ${siteUrl}/property/${property.slug}`
    );
  });

  let message =
    `¡Mira estas oportunidades! (${properties.length})\n\n` + lines.join("\n\n");

  if (hidden > 0) {
    message += `\n\n… y ${hidden} ${hidden === 1 ? "propiedad más" : "propiedades más"} en ${siteUrl}/favorites`;
  }

  return message;
}

export function buildWhatsAppConsolidatedShareLink(
  properties: ShareProperty[],
  siteUrl: string,
): string {
  const message = buildConsolidatedMessage(properties, siteUrl);
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

/**
 * Builds a wa.me link to the human advisor so a visitor (site or WhatsApp bot)
 * can escalate to a real person at any moment.
 */
export function buildAdvisorLink(advisorPhone: string): string {
  const phone = advisorPhone.replace(/\D/g, "");
  const text = encodeURIComponent(
    "Hola 👋 vengo del buscador de Propiedades y quiero que un asesor me atienda.",
  );
  return `https://wa.me/${phone}?text=${text}`;
}
