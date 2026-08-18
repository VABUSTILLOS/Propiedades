"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandColor } from "@/modules/brand/data";

export function ColorSwatch({ color }: { color: BrandColor }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(color.hex);
    } catch {
      // clipboard may be unavailable (e.g. insecure context); ignore
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copiar ${color.hex}`}
      className="group flex w-full flex-col gap-2 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className={cn(
          "flex h-24 items-end justify-end rounded-xl p-2 ring-1 ring-foreground/10 transition-transform group-hover:-translate-y-0.5"
        )}
        style={{ backgroundColor: color.hex }}
      >
        <span className="rounded-md bg-black/10 px-1.5 py-0.5 font-mono text-[11px] text-white backdrop-blur-sm">
          {color.hex}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div>
          <p className="text-sm font-medium">{color.name}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{color.token}</p>
        </div>
        <span
          className={cn(
            "text-muted-foreground transition-colors",
            copied && "text-live",
            !copied && "opacity-0 group-hover:opacity-100"
          )}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </span>
      </div>
      <p className="px-0.5 text-xs leading-relaxed text-muted-foreground">{color.usage}</p>
      {color.note ? (
        <p className="rounded-md bg-muted px-0.5 py-1 text-[11px] font-medium text-muted-foreground">
          {color.note}
        </p>
      ) : null}
    </button>
  );
}
