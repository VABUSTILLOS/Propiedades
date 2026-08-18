import { X, Check } from "lucide-react";
import type { VoiceExample } from "@/modules/brand/data";

export function VoiceCard({ example }: { example: VoiceExample }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {example.tone}
      </p>
      <div className="space-y-3">
        <div className="flex gap-2.5">
          <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm leading-relaxed text-muted-foreground line-through decoration-muted-foreground/50">
            {example.bad}
          </p>
        </div>
        <div className="flex gap-2.5">
          <Check className="mt-0.5 size-4 shrink-0 text-live" aria-hidden />
          <p className="text-sm font-medium leading-relaxed">{example.good}</p>
        </div>
      </div>
    </div>
  );
}
