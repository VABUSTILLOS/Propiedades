import type { ChatResult } from "@/modules/chat/types";

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

/** Minimal property shape needed to render a line in a consolidated share. */
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
export function buildWhatsAppConsolidatedShareLink(
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

  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}
