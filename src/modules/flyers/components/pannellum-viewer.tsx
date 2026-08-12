"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  url: string;
  title?: string;
};

type Pannellum = {
  viewer: (id: string, config: Record<string, unknown>) => {
    destroy: () => void;
  };
};

/**
 * 360° panorama viewer powered by Pannellum.js, loaded lazily on first use.
 * Displays a graceful fallback until the script loads or if it fails.
 */
export function PannellumViewer({ url, title }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<{ destroy: () => void } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    const loadPannellum = async () => {
      try {
        const existing = document.getElementById("pannellum-script");
        if (!existing) {
          const script = document.createElement("script");
          script.id = "pannellum-script";
          script.src = "https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js";
          script.async = true;
          document.head.appendChild(script);

          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("No se pudo cargar Pannellum"));
          });
        }

        const css = document.getElementById("pannellum-css");
        if (!css) {
          const link = document.createElement("link");
          link.id = "pannellum-css";
          link.rel = "stylesheet";
          link.href =
            "https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css";
          document.head.appendChild(link);
        }

        if (cancelled || !containerRef.current) return;

        const pannellum = (window as unknown as { pannellum?: Pannellum }).pannellum;
        if (!pannellum) throw new Error("Pannellum global not found");

        viewerRef.current = pannellum.viewer(containerRef.current.id, {
          type: "equirectangular",
          panorama: url,
          autoLoad: true,
          showZoomCtrl: false,
          title,
        });
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    };

    void loadPannellum();

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [url, title]);

  return (
    <div className="relative overflow-hidden rounded-lg border bg-muted">
      <div
        ref={containerRef}
        id="pannellum-container"
        className="aspect-video w-full"
      />
      {state === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-muted/60 text-sm text-muted-foreground">
          Cargando vista 360°…
        </div>
      )}
      {state === "error" && (
        <div className="flex aspect-video w-full items-center justify-center bg-muted text-sm text-muted-foreground">
          La vista 360° no está disponible.
        </div>
      )}
    </div>
  );
}
