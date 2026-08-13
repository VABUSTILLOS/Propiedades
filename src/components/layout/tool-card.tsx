import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

/**
 * Dashboard tool card with the homepage card language: gradient icon chip,
 * lift + shadow on hover and an arrow that slides in.
 */
export function ToolCard({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
    >
      <span className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-chart-2 to-chart-3 text-white shadow-sm">
        <Icon className="size-5" />
      </span>
      <h2 className="font-semibold group-hover:text-primary">{title}</h2>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{description}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        Abrir
        <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}
