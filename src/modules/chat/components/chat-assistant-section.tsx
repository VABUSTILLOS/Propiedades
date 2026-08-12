import { Bot, Sparkles } from "lucide-react";

import { ChatWidget } from "@/modules/chat/components/chat-widget";

/**
 * Dedicated homepage section that hosts the chat assistant. The hero keeps
 * the classic search bar; this section makes the conversational search
 * prominently available for users who prefer describing what they want in
 * plain language.
 */
export function ChatAssistantSection() {
  return (
    <section className="border-t bg-gradient-to-b from-background to-muted/40">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <Bot className="size-3.5" />
            Asistente inteligente
          </span>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Describe la propiedad que buscas y nosotros la encontramos
          </h2>
          <p className="mt-2 text-muted-foreground">
            Escribe en lenguaje natural, por ejemplo{" "}
            <span className="font-medium text-foreground">
              “casas en Chihuahua de 2,000,000 MXN”
            </span>
            , y nuestro asistente filtra el inventario por ti.
          </p>
        </div>

        <div className="mx-auto w-full max-w-3xl">
          <ChatWidget />
        </div>

        <p className="mx-auto mt-6 flex max-w-xl items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Sparkles className="size-3.5" />
          También puedes refinar tu búsqueda con mensajes como “y más baratas”
          o “con alberca”.
        </p>
      </div>
    </section>
  );
}
