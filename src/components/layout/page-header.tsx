import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Unified page header matching the "registro de oportunidades" visual
 * language: mono folio eyebrow with a terracotta marker, bold tracking-tight
 * title and muted description, plus an optional flat icon chip and an
 * actions slot. Shared by every section page so the whole site reads in
 * the same voice as the homepage.
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
          <span className="hidden size-11 shrink-0 items-center justify-center rounded-2xl border bg-muted text-primary sm:flex">
            <Icon className="size-5" />
          </span>
        )}
        <div>
          {eyebrow && (
            <span className="mb-2 inline-flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
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
