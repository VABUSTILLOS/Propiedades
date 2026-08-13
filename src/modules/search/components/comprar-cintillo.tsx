"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Banknote,
  Hammer,
  Repeat,
  Store,
  Tractor,
  TrendingUp,
  Wrench,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { InvestorTab } from "@/modules/lib/schemas";

const TAB_DEFS: {
  value: InvestorTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "todos", label: "Todos", icon: Store },
  { value: "remate", label: "Remates", icon: Hammer },
  { value: "flipping", label: "Flipping", icon: Wrench },
  { value: "traspaso", label: "Traspasos", icon: Repeat },
  { value: "comercial", label: "Comercial", icon: Banknote },
  { value: "terreno", label: "Terrenos", icon: Tractor },
];

/**
 * Cintillo superior de la página fusionada "Comprar": bloque
 * "Invertir · Modo inversionista" + pestañas con conteo dinámico.
 * Cada pestaña navega a /search?tab=<value> preservando el resto
 * de los search params.
 */
export function ComprarCintillo({
  activeTab,
  counts,
}: {
  activeTab: InvestorTab;
  counts: Record<InvestorTab, number>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectTab = (value: InvestorTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.delete("pageSize");
    if (value === "todos") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  };

  return (
    <div className="mb-8 space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <TrendingUp className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Invertir</p>
          <p className="text-xs text-muted-foreground">Modo inversionista</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => selectTab(value as InvestorTab)}>
        <TabsList variant="line" className="w-full overflow-x-auto">
          {TAB_DEFS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-none rounded-lg px-4 py-1.5 data-active:shadow-none"
            >
              <Icon className="size-4" />
              {label}
              <span
                className={cn(
                  "ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                  value === activeTab
                    ? "bg-foreground/10 text-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {counts[value]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
