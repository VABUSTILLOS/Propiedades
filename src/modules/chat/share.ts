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
