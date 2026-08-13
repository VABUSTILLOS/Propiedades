"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";

import { ChatResultCard } from "@/modules/chat/components/chat-result-card";
import { ChatActionsBar } from "@/modules/chat/components/chat-actions-bar";
import type { ChatFilters, ChatResponse, ChatTurn } from "@/modules/chat/types";

const SUGGESTIONS = [
  "Casas en Chihuahua de 2,000,000 MXN",
  "Departamentos en Chihuahua",
  "Terrenos de 500 m²",
  "Casas con alberca por menos de 5 millones",
];

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Chat widget for the homepage hero. Stateless: every message goes to
 * POST /api/chat, which interprets it (the server resolves the searchable
 * cities), searches the DB and returns a reply plus result cards. Holds the
 * previous filters so follow-ups like "y más baratas" refine the current
 * search instead of starting over.
 */
export function ChatWidget() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ChatFilters | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the conversation scrolled to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, isLoading]);

  const sendMessage = async (text: string, includeAlternatives = false) => {
    const message = text.trim();
    if (!message || isLoading) return;

    const userTurn: ChatTurn = { id: newId(), role: "user", content: message };
    setTurns((prev) => [...prev, userTurn]);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          previousFilters: filters,
          includeAlternatives,
        }),
      });

      if (!res.ok) {
        throw new Error(`Chat API responded ${res.status}`);
      }

      const data = (await res.json()) as ChatResponse;
      const assistantTurn: ChatTurn = {
        id: newId(),
        role: "assistant",
        content: data.reply,
        results: data.results,
        matched: data.matched,
        relaxed: data.relaxed,
        requestMessage: message,
      };
      setTurns((prev) => [...prev, assistantTurn]);
      setFilters(data.filters);
    } catch {
      setError(
        "No pude procesar tu búsqueda. Inténtalo de nuevo en un momento.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const showSuggestions = turns.length === 0;

  const results = turns.flatMap((t) => t.results ?? []);

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/95 text-left shadow-2xl backdrop-blur-md">
      {/* Conversación */}
      <div
        ref={scrollRef}
        className="max-h-[26rem] min-h-[16rem] space-y-3 overflow-y-auto p-4"
      >
        {showSuggestions ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Escribe qué estás buscando y te muestro propiedades que coincidan.
              Por ejemplo:
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void sendMessage(s)}
                  className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn) => (
            <div key={turn.id}>
              {turn.role === "user" ? (
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-primary to-copper-deep px-4 py-2 text-sm text-white">
                    {turn.content}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-start">
                    <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-muted px-4 py-2 text-sm">
                      {turn.content}
                    </p>
                  </div>
                  {turn.results && turn.results.length > 0 && (
                    <div className="space-y-3 pt-1">
                      {turn.results.map((result) => (
                        <ChatResultCard key={result.id} result={result} />
                      ))}
                    </div>
                  )}
                  {turn.role === "assistant" &&
                    turn.matched === false &&
                    !turn.relaxed &&
                    turn.requestMessage && (
                      <div className="flex justify-start pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            void sendMessage(turn.requestMessage!, true)
                          }
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                        >
                          Ver alternativas
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <p className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-4 py-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Buscando propiedades…
            </p>
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border/60 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ej. casas en Chihuahua de 2,000,000 MXN"
          maxLength={500}
          aria-label="Describe la propiedad que buscas"
          autoComplete="off"
          spellCheck={false}
          className="h-10 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm text-primary caret-primary outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-label="Enviar búsqueda"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-copper-deep text-white shadow-sm transition-all hover:from-copper-deep hover:to-copper-ink disabled:pointer-events-none disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </form>

      {/* Acciones de WhatsApp: compartir, enviar a mi número, asesor humano */}
      <ChatActionsBar results={results} filters={filters} />
    </div>
  );
}
