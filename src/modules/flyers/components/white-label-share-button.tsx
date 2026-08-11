"use client";

import { useState, useTransition } from "react";
import { CopyCheck, Share2 } from "lucide-react";

import { shareWhiteLabel } from "@/modules/flyers/actions";
import { Button } from "@/components/ui/button";

/**
 * White-label share: re-badges an existing public flyer as the current
 * agent's brand. Calls the shareWhiteLabel server action (optimistic no-op
 * — the button only shows a success state after the clone is created).
 */
export function WhiteLabelShareButton({ slug }: { slug: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ slug: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const share = () => {
    setError(null);
    startTransition(async () => {
      const res = await shareWhiteLabel({ slug });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data);
    });
  };

  if (result) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <CopyCheck className="size-4 text-emerald-600" />
        <span>
          Clonado como{" "}
          <a href={`/f/${result.slug}`} className="text-primary hover:underline">
            /f/{result.slug}
          </a>
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={share}
      >
        <Share2 className="mr-2 size-4" />
        {isPending ? "Compartiendo…" : "Compartir marca blanca"}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
