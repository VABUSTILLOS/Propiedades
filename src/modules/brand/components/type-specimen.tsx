import { cn } from "@/lib/utils";
import type { BrandType } from "@/modules/brand/data";

export function TypeSpecimen({ type }: { type: BrandType }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
      <div
        className={cn(
          "truncate text-2xl text-foreground sm:text-3xl",
          type.sampleClass
        )}
      >
        {type.sample}
      </div>
      <div className="mt-auto space-y-1 pt-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">{type.name}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{type.weights}</p>
        </div>
        <p className="text-xs text-muted-foreground">{type.css}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{type.details}</p>
      </div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {type.role}
      </p>
    </div>
  );
}
