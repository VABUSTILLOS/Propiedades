"use client";

import { cn } from "@/lib/utils";
import { PROPERTY_CATEGORIES } from "@/modules/lib/schemas";
import { CATEGORY_LABELS } from "@/modules/lib/real-estate";
import type { PropertyCategory } from "@/modules/lib/database.types";

/** Property-type options shown as togglable pills in both search modes. */
export const CATEGORY_OPTIONS = PROPERTY_CATEGORIES.map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));

/**
 * Presentational multi-select for property types. No navigation of its own:
 * parents decide how the selection is persisted (URL param, form state…).
 */
export function CategoryPills({
  selected,
  onChange,
  className,
  id,
  "aria-label": ariaLabel = "Tipo de propiedad",
}: {
  selected: PropertyCategory[];
  onChange: (next: PropertyCategory[]) => void;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const toggle = (value: PropertyCategory) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  return (
    <div
      id={id}
      role="group"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {CATEGORY_OPTIONS.map(({ value, label }) => {
        const active = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(value)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
