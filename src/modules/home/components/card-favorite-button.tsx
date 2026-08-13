"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Loader2 } from "lucide-react";

import { toggleFavorite } from "@/modules/favorites/actions";
import { cn } from "@/lib/utils";

type Props = {
  propertyId: string;
  propertySlug: string;
  /** Whether the current user already saved this property. */
  initialSaved: boolean;
};

/**
 * Compact bookmark toggle overlaying the property card image. Toggling
 * the favorites list; anonymous visitors are sent to sign-up.
 */
export function CardFavoriteButton({ propertyId, propertySlug, initialSaved }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const res = await toggleFavorite(propertyId);
      if (!res.ok) {
        if (res.code === "AUTH_REQUIRED") {
          router.push(`/sign-up?next=/property/${propertySlug}`);
          return;
        }
        return;
      }
      setSaved(res.data.saved);
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={saved ? "Quitar de favoritos" : "Guardar en favoritos"}
      aria-pressed={saved}
      className={cn(
        "flex size-9 items-center justify-center rounded-full shadow-sm backdrop-blur transition-colors",
        saved
          ? "bg-copper text-white"
          : "bg-white/90 text-neutral-700 hover:bg-white",
      )}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Bookmark className={cn("size-4", saved && "fill-current")} />
      )}
    </button>
  );
}
