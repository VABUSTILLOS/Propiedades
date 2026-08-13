"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORT_OPTIONS = [
  { value: "newest", label: "Más recientes" },
  { value: "oldest", label: "Más antiguas" },
  { value: "hot", label: "Más hot (oportunidad)" },
  { value: "price_asc", label: "Precio (menor → mayor)" },
  { value: "price_desc", label: "Precio (mayor → menor)" },
  { value: "m2_const_asc", label: "Precio/m² construido (menor → mayor)" },
  { value: "m2_const_desc", label: "Precio/m² construido (mayor → menor)" },
  { value: "score", label: "Mejor score" },
];

/**
 * Sort dropdown for /listados. Each selection navigates to
 * /listados?sortBy=<value> preserving the remaining search params, which
 * re-renders the server-side results grid in the new order.
 */
export function ListadosSort() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sortBy = searchParams.get("sortBy") ?? "newest";

  const changeSort = (value: string | null) => {
    const next = value ?? "newest";
    const params = new URLSearchParams(searchParams.toString());
    if (next === "newest") params.delete("sortBy");
    else params.set("sortBy", next);
    const qs = params.toString();
    router.push(qs ? `/listados?${qs}` : "/listados", { scroll: false });
  };

  return (
    <div className="flex items-center gap-2">
      <Label className="shrink-0 text-xs" htmlFor="listados-sort">
        Ordenar
      </Label>
      <Select value={sortBy} onValueChange={changeSort}>
        <SelectTrigger size="sm" id="listados-sort" className="rounded-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map(({ value, label }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
