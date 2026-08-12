"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ListadosTab } from "@/modules/lib/schemas";

const TAB_DEFS: { value: ListadosTab; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "venta", label: "Venta" },
  { value: "renta", label: "Renta" },
  { value: "tierra", label: "Tierra" },
];

/**
 * Portal tab bar for /listados. Each tab navigates to /listados?tab=<value>,
 * preserving the remaining search params so refinements survive tab switches.
 */
export function ListadosTabs({
  activeTab,
  counts,
}: {
  activeTab: ListadosTab;
  counts: Record<ListadosTab, number>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectTab = (value: ListadosTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.delete("pageSize");
    if (value === "todos") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const qs = params.toString();
    router.push(qs ? `/listados?${qs}` : "/listados");
  };

  return (
    <Tabs value={activeTab} onValueChange={(value) => selectTab(value as ListadosTab)}>
      <TabsList variant="line" className="w-full overflow-x-auto">
        {TAB_DEFS.map(({ value, label }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="flex-none rounded-lg px-4 py-1.5 data-active:shadow-none"
          >
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
  );
}
