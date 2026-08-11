"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { importPropertyFromUrl } from "@/modules/ingestion/actions";
import type { ImportResult } from "@/modules/ingestion/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Props = {
  userId: string;
};

type ImportSource = "url" | "text" | "voice";

/**
 * Stage 2 — multimodal property import.
 * URL / free text / voice note → AI extraction → draft + auto-flyer.
 * Shows the extracted result and redirects to the live flyer on success.
 */
export function ImportForm({ userId: _userId }: Props) {
  const router = useRouter();
  const [source, setSource] = useState<ImportSource>("url");
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const submit = () =>
    startTransition(async () => {
      setError(null);
      setResult(null);
      const res = await importPropertyFromUrl({ source, content });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data);
      router.push(`/f/${res.data.flyerSlug}`);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <Tabs value={source} onValueChange={(value) => setSource(value as ImportSource)}>
        <TabsList>
          <TabsTrigger value="url">Facebook URL</TabsTrigger>
          <TabsTrigger value="text">Free text</TabsTrigger>
          <TabsTrigger value="voice">Voice note</TabsTrigger>
        </TabsList>

        <TabsContent value="url">
          <div className="space-y-2">
            <Label htmlFor="import-url">
              URL pública (Facebook Marketplace u otro portal)
            </Label>
            <Input
              id="import-url"
              type="url"
              placeholder="https://www.facebook.com/marketplace/item/…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        </TabsContent>

        <TabsContent value="text">
          <div className="space-y-2">
            <Label htmlFor="import-text">
              Describe el inmueble en lenguaje natural
            </Label>
            <Textarea
              id="import-text"
              placeholder={'Casa de 3 recámaras en la colonia Del Valle, $2,500,000. Patio de 3m, cerca de escuelas y parques…'}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-40"
            />
          </div>
        </TabsContent>

        <TabsContent value="voice">
          <div className="space-y-2">
            <Label htmlFor="import-voice">
              URL de audio o transcripción de la nota de voz
            </Label>
            <Input
              id="import-voice"
              placeholder="https://…/nota.mp3  o pega la transcripción aquí"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              La transcripción con Whisper requiere la Edge Function
              <code className="mx-1 rounded bg-muted px-1">import-property-ai</code>
              y una
              <code className="mx-1 rounded bg-muted px-1">OPENAI_API_KEY</code>.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <Button disabled={isPending || content.trim().length < 3} onClick={submit}>
        {isPending ? "Extrayendo con IA…" : "Importar con IA"}
      </Button>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {result && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <p className="font-medium">{result.extracted.titulo}</p>
            <p className="text-sm text-muted-foreground">
              ${result.extracted.precio.toLocaleString("es-MX")} MXN
              {result.extracted.recamaras != null && ` · ${result.extracted.recamaras} rec.`}
              {result.extracted.banos != null && ` · ${result.extracted.banos} baños`}
            </p>
            {result.extracted.puntos_fuertes_bento.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {result.extracted.puntos_fuertes_bento.join(" · ")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Listado creado · Redirigiendo al flyer /f/{result.flyerSlug}…
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
