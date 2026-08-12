"use client";

import { WhatsAppIcon } from "@/modules/chat/components/share-whatsapp-button";
import { buildWhatsAppInquiryLink } from "@/modules/chat/share";
import { cn } from "@/lib/utils";

/**
 * "Preguntar por esta propiedad" — opens WhatsApp with the business number
 * pre-filled with a message asking about the property. Renders as an anchor
 * so it works without JS handlers.
 */
export function WhatsAppInquiryButton({
  title,
  colonia,
  city,
  className,
}: {
  title: string;
  colonia?: string | null;
  city?: string | null;
  className?: string;
}) {
  const href = buildWhatsAppInquiryLink({ title, colonia, city });

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Preguntar por ${title} en WhatsApp`}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] font-medium text-white shadow-sm transition-colors hover:bg-[#1ebe5b] hover:text-white",
        className,
      )}
    >
      <WhatsAppIcon className="size-5" />
      Preguntar por esta propiedad
    </a>
  );
}
