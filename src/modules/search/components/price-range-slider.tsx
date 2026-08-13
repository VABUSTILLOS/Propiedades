"use client";

import { Slider } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";
import { formatMxn } from "@/modules/lib/real-estate";

/** Rental listings top out around this; used as the rent slider ceiling. */
export const RENT_PRICE_MAX = 100_000;
/** Sale listings can reach millions; used as the sale slider ceiling. */
export const SALE_PRICE_MAX = 10_000_000;

interface PriceRangeSliderProps {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (next: [number, number]) => void;
  onCommitted?: (next: [number, number]) => void;
  format?: (value: number) => string;
  className?: string;
}

/**
 * Dual-thumb price range slider built on Base UI. Shows the current min/max
 * formatted as MXN and lets the user drag either end. `value` is the current
 * range, so callers can bind it to their filter state. `onChange` fires on
 * every drag tick; `onCommitted` fires once when the drag/keyboard interaction
 * ends, which is the right place to trigger navigation or expensive updates.
 */
export function PriceRangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  onCommitted,
  format = formatMxn,
  className,
}: PriceRangeSliderProps) {
  const [minValue, maxValue] = value;

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1 flex items-center justify-between text-sm font-medium tabular-nums">
        <span className="text-foreground">{format(minValue)}</span>
        <span className="text-foreground">{format(maxValue)}</span>
      </div>

      <Slider.Root
        min={min}
        max={max}
        step={step}
        value={[minValue, maxValue]}
        onValueChange={(next) =>
          onChange([next[0] ?? minValue, next[1] ?? maxValue])
        }
        onValueCommitted={(next) =>
          onCommitted?.([next[0] ?? minValue, next[1] ?? maxValue])
        }
      >
        <Slider.Control className="flex w-full touch-none items-center py-2 select-none">
          <Slider.Track className="h-1.5 w-full rounded-full bg-muted select-none">
            <Slider.Indicator className="rounded-full bg-primary select-none" />
            <Slider.Thumb
              index={0}
              aria-label="Precio mínimo"
              className="size-4 rounded-full border-2 border-primary bg-background shadow-sm select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
            />
            <Slider.Thumb
              index={1}
              aria-label="Precio máximo"
              className="size-4 rounded-full border-2 border-primary bg-background shadow-sm select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
            />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </div>
  );
}
