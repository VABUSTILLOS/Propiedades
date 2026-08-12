"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Loader2 } from "lucide-react";

import { upsertFavorite } from "@/modules/favorites/actions";
import { Button } from "@/components/ui/button";

type Props = {
  propertyId: string;
  propertySlug: string;
  /** Whether the current user already saved this property. */
  initialSaved: boolean;
};

/**
 * Save a property to the user's favorites. Anonymous visitors are redirected
 * to /sign-up so they can unlock persistence.
 */
export function SaveFavoriteButton({ propertyId, propertySlug, initialSaved }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await upsertFavorite({ propertyId });
      if (!res.ok) {
        if (res.code === "AUTH_REQUIRED") {
          router.push(`/sign-up?next=/property/${propertySlug}`);
          return;
        }
        setError(res.error);
        return;
      }
      setSaved(true);
    });

  return (
    <div>
      {error && (
        <p className="mb-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button
        variant={saved ? "secondary" : "outline"}
        className="w-full"
        disabled={isPending}
        onClick={save}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Bookmark className="size-4" />
        )}
        {saved ? "Guardada" : "Guardar propiedad"}
      </Button>
    </div>
  );
}
