"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createTransaction } from "@/modules/transactions/actions";
import { Button } from "@/components/ui/button";

type Props = {
  propertyId: string;
  propertySlug: string;
};

/**
 * Start a transaction (inquiry) on a listing, then jump into the thread.
 * Anonymous visitors are redirected to sign-up first.
 */
export function InquireButton({ propertyId, propertySlug }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const inquire = () =>
    startTransition(async () => {
      setError(null);
      const res = await createTransaction({ propertyId });
      if (!res.ok) {
        if (res.code === "AUTH_REQUIRED") {
          router.push(`/sign-up?next=/property/${propertySlug}`);
          return;
        }
        setError(res.error);
        return;
      }
      router.push(`/transactions/${res.data.id}`);
    });

  return (
    <div>
      {error && (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button className="w-full" disabled={isPending} onClick={inquire}>
        {isPending ? "Starting…" : "Inquire about this property"}
      </Button>
    </div>
  );
}
