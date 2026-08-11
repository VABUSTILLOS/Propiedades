"use client";

import { useState, useTransition } from "react";
import { MessageCircleHeart, Send, ThumbsDown, ThumbsUp } from "lucide-react";

import { postChatMessage, voteFavorite } from "@/modules/co-shopping/actions";
import type { ChatMessage } from "@/modules/co-shopping/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FavoriteWithProperty } from "@/modules/favorites/queries";

type Props = {
  favorites: FavoriteWithProperty[];
  initialChat: Record<string, ChatMessage[]>;
};

/**
 * Co-shopping: like/dislike voting + private chat per shared favorite.
 * Works for a couple/co-buyer shortlist; RLS restricts to participants.
 */
export function CoShoppingPanel({ favorites, initialChat }: Props) {
  const [votes, setVotes] = useState<Record<string, { likes: number; dislikes: number }>>(
    () =>
      Object.fromEntries(
        favorites.map((f) => {
          const v = (f.co_buyer_votes ?? {}) as Record<string, unknown>;
          const likes =
            typeof v.likes === "number"
              ? v.likes
              : Object.entries(v).filter(
                  ([k, val]) => k.endsWith("_vote") && val === "like",
                ).length;
          const dislikes =
            typeof v.dislikes === "number"
              ? v.dislikes
              : Object.entries(v).filter(
                  ([k, val]) => k.endsWith("_vote") && val === "dislike",
                ).length;
          return [f.id, { likes, dislikes }];
        }),
      ),
  );
  const [chat, setChat] = useState<Record<string, ChatMessage[]>>(initialChat);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const vote = (favoriteId: string, voteKind: "like" | "dislike") =>
    startTransition(() => {
      setError(null);
      void voteFavorite({ favoriteId, vote: voteKind }).then((res) => {
        if (res.ok) {
          setVotes((prev) => ({ ...prev, [favoriteId]: res.data }));
        } else {
          setError(res.error);
        }
      });
    });

  const send = (favoriteId: string) =>
    startTransition(() => {
      const content = (draft[favoriteId] ?? "").trim();
      if (!content) return;
      setError(null);
      void postChatMessage({ favoriteId, content }).then((res) => {
        if (res.ok) {
          setChat((prev) => ({
            ...prev,
            [favoriteId]: [...(prev[favoriteId] ?? []), res.data.message],
          }));
          setDraft((prev) => ({ ...prev, [favoriteId]: "" }));
        } else {
          setError(res.error);
        }
      });
    });

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <MessageCircleHeart className="size-5 text-primary" />
        Co-Shopping
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Vota con tu pareja o co-comprador y comenta cada candidato en privado.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {favorites.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aún no tienes favoritos para co-evaluar.
          </p>
        )}

        {favorites.map((f) => {
          const v = votes[f.id] ?? { likes: 0, dislikes: 0 };
          const messages = chat[f.id] ?? [];
          return (
            <div key={f.id} className="rounded-md border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{f.property?.title ?? "Propiedad"}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.property?.colonia}, {f.property?.city}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => vote(f.id, "like")}
                    className={cn("gap-1.5", (v.likes ?? 0) > 0 && "text-emerald-600")}
                  >
                    <ThumbsUp className="size-3.5" />
                    {v.likes ?? 0}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => vote(f.id, "dislike")}
                    className={cn("gap-1.5", (v.dislikes ?? 0) > 0 && "text-rose-600")}
                  >
                    <ThumbsDown className="size-3.5" />
                    {v.dislikes ?? 0}
                  </Button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {messages.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Sin comentarios todavía.
                  </p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className="text-sm">
                    <span className="font-medium text-muted-foreground">
                      {m.sender_name}:
                    </span>{" "}
                    {m.content}
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(f.id);
                }}
                className="mt-3 flex gap-2"
              >
                <Input
                  value={draft[f.id] ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [f.id]: e.target.value }))
                  }
                  placeholder="Opina sobre esta propiedad…"
                  className="text-sm"
                />
                <Button type="submit" size="icon" disabled={isPending} aria-label="Enviar">
                  <Send className="size-4" />
                </Button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
