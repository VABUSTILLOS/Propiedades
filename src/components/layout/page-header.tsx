import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Unified page header matching the homepage visual language:
 * pill eyebrow badge, bold tracking-tight title and muted description,
 * with an optional gradient icon chip and an actions slot.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {Icon && (
          <span className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-chart-2 to-chart-3 text-white shadow-sm sm:flex">
            <Icon className="size-5" />
          </span>
        )}
        <div>
          {eyebrow && (
            <span className="mb-2 inline-flex items-center rounded-full border bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary-foreground">
              {eyebrow}
            </span>
          )}
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
