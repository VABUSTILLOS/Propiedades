import Link from "next/link";
import { Pencil } from "lucide-react";

/**
 * "Editar" pill overlaid on a property card in master-user editor mode.
 * Points at the admin edit wizard. Server-safe (no state/handlers) so it can
 * be embedded by both the server-safe PropertyCard and the client-search
 * SearchResultCard. `role="button"` keeps the moderation selection-mode click
 * capture from hijacking the link.
 */
export function PropertyEditLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      role="button"
      className="absolute bottom-3 left-3 z-30 inline-flex items-center gap-1 rounded-full bg-background/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm ring-1 ring-border backdrop-blur transition-colors hover:bg-primary hover:text-primary-foreground"
    >
      <Pencil className="size-3.5" />
      Editar
    </Link>
  );
}
