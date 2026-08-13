import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

/**
 * Dashboard tool card in the registry language: flat terracotta icon chip,
 * optional mono index in the corner and a mono "Abrir" affordance whose
 * arrow lifts on hover — the same micro-interaction as the opportunity
 * ledger rows on the homepage.
 */
export function ToolCard({
  title,
  description,
  href,
  icon: Icon,
  index,
}: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Zero-padded mono index shown in the corner, e.g. "01". */
  index?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl border bg-muted text-primary">
          <Icon className="size-5" />
        </span>
        {index && (
          <span className="font-mono text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
            {index}
          </span>
        )}
      </div>
      <h2 className="font-semibold group-hover:text-primary">{title}</h2>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{description}</p>
      <span className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.14em] text-primary">
        Abrir
        <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
