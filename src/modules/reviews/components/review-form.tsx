"use client";

import { useState, useTransition } from "react";

import { createReview } from "@/modules/reviews/actions";
import { Button } from "@/components/ui/button";

type Props = {
  transactionId: string;
  subjectId: string;
};

/**
 * Double-blind review: submitted after a transaction closes. The subject
 * (other party) is hidden until both participants have reviewed.
 */
export function ReviewForm({ transactionId, subjectId }: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await createReview({
        transactionId,
        subjectId,
        rating,
        comment: comment.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSubmitted(true);
    });

  if (submitted) {
    return (
      <p className="rounded-lg border bg-card p-4 text-sm text-emerald-600">
        Reseña enviada. Se publicará cuando la otra parte también envíe la suya.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold">Deja una reseña</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Tu reseña es anónima hasta que la otra parte envíe la suya.
      </p>

      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-3 space-y-3">
        <label className="block space-y-1 text-xs text-muted-foreground">
          Calificación
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="block rounded-md border bg-background px-2 py-1 text-sm text-foreground"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "estrella" : "estrellas"}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-xs text-muted-foreground">
          Comentario
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="¿Cómo fue tu experiencia?"
            className="block w-full rounded-md border bg-background px-2 py-1 text-sm text-foreground"
          />
        </label>

        <Button size="sm" disabled={isPending} onClick={submit}>
          Enviar reseña
        </Button>
      </div>
    </div>
  );
}
