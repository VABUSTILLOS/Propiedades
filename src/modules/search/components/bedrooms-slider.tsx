"use client";

import { Slider } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

/** Bedrooms slider ceiling; the top value renders as "7 o más". */
export const MAX_BEDROOMS = 7;

function bedroomsLabel(value: number): string {
  if (value <= 0) return "Cualquiera";
  if (value >= MAX_BEDROOMS) return "7 o más";
  return `${value}+`;
}

interface BedroomsSliderProps {
  /** Minimum number of bedrooms; 0 means "Cualquiera" (no filter). */
  value: number;
  onChange: (next: number) => void;
  onCommitted?: (next: number) => void;
  className?: string;
}

/**
 * Single-thumb slider for the minimum number of bedrooms (recámaras).
 * 0 = "Cualquiera", 1–6 render as "N+", 7 renders as "7 o más". `onChange`
 * fires on every drag tick; `onCommitted` fires once the interaction ends,
 * which is the right place to trigger navigation or expensive updates.
 */
export function BedroomsSlider({
  value,
  onChange,
  onCommitted,
  className,
}: BedroomsSliderProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="mb-2 flex items-center justify-between text-sm font-medium tabular-nums">
        <span className="text-foreground">{bedroomsLabel(value)}</span>
      </div>

      <Slider.Root
        min={0}
        max={MAX_BEDROOMS}
        step={1}
        value={value}
        onValueChange={(next) => onChange(next)}
        onValueCommitted={(next) => onCommitted?.(next)}
      >
        <Slider.Control className="flex w-full touch-none items-center py-3 select-none">
          <Slider.Track className="h-1.5 w-full rounded-full bg-muted select-none">
            <Slider.Indicator className="rounded-full bg-primary select-none" />
            <Slider.Thumb
              index={0}
              aria-label="Recámaras mínimas"
              className="size-4 rounded-full border-2 border-primary bg-background shadow-sm select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
            />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Cualquiera</span>
        <span>7 o más</span>
      </div>
    </div>
  );
}
