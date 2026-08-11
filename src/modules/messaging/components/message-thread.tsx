"use client";

import { useEffect, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/modules/lib/supabase/browser";
import { sendMessage } from "@/modules/messaging/actions";
import { ActionCard } from "@/modules/messaging/components/action-card";
import { messageActionCardSchema } from "@/modules/lib/schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { MessagesRow } from "@/modules/lib/database.types";

type ThreadProps = {
  transactionId: string;
  currentUserId: string;
  initialMessages: MessagesRow[];
  /** Whether the viewer is the listing owner — drives action buttons. */
  viewerIsOwner?: boolean;
};

/**
 * Realtime message thread bound to a transaction. New rows from the
 * `messages` table (scoped by RLS) stream in via Supabase Realtime.
 */
export function MessageThread({
  transactionId,
  currentUserId,
  initialMessages,
  viewerIsOwner = false,
}: ThreadProps) {
  const [messages, setMessages] = useState<MessagesRow[]>(initialMessages);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`messages:${transactionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `transaction_id=eq.${transactionId}`,
        },
        (payload) => {
          const row = payload.new as MessagesRow;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row],
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [transactionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);
    const res = await sendMessage({ transactionId, content: trimmed });
    setSending(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    setContent("");
  };

  return (
    <div className="flex h-[480px] flex-col rounded-lg border bg-card">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages yet — start the conversation.
          </p>
        )}

        {messages.map((message) => {
          const isOwn = message.sender_id === currentUserId;
          const hasCard =
            message.is_system_event &&
            message.action_payload != null &&
            messageActionCardSchema.safeParse(message.action_payload).success;

          if (hasCard) {
            return (
              <div key={message.id} className="flex justify-center">
                <ActionCard
                  message={message}
                  transactionId={transactionId}
                  viewerIsOwner={viewerIsOwner}
                />
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={cn("flex", isOwn ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                  message.is_system_event
                    ? "mx-auto bg-muted text-center text-xs text-muted-foreground"
                    : isOwn
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                )}
              >
                {message.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3">
        {error && (
          <p className="mb-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Type a message…"
            rows={2}
            disabled={sending}
          />
          <Button onClick={() => void submit()} disabled={sending || !content.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
