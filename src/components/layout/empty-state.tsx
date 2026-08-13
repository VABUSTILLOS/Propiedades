import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Unified empty state: dashed border card with icon, message and
 * optional call to action. Replaces ad-hoc `border-dashed` blocks.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title?: string;
  description: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
          <Icon className="size-6" />
        </span>
      )}
      {title && <h2 className="font-semibold">{title}</h2>}
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
