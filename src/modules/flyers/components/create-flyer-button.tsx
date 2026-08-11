"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createFlyer } from "@/modules/flyers/actions";
import { Button } from "@/components/ui/button";

type Props = {
  propertyId: string;
};

/**
 * Create a digital flyer for a listing and open its public share page.
 */
export function CreateFlyerButton({ propertyId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const create = () =>
    startTransition(async () => {
      setError(null);
      const res = await createFlyer({ propertyId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/f/${res.data.slug}`);
    });

  return (
    <div>
      {error && (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={create}
      >
        Create flyer
      </Button>
    </div>
  );
}
