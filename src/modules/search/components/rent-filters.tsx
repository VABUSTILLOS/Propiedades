"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryPills } from "@/modules/search/components/category-pills";
import { parseCategoriesParam } from "@/modules/lib/schemas";
import type { PropertyCategory } from "@/modules/lib/database.types";

/**
 * GET-form filters for the /rentas page. Submitting navigates to
 * /rentas?<params>, which re-renders the server-side results grid.
 * The `type=rent` param is always included so results stay in the rent category.
 */
export function RentFiltersForm({ colonias }: { colonias: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [categories, setCategories] = useState<PropertyCategory[]>(() => {
    const csv = searchParams.get("categories");
    if (csv) return parseCategoriesParam(csv);
    return parseCategoriesParam(searchParams.get("category"));
  });
  const [colonia, setColonia] = useState(searchParams.get("colonia") ?? "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const [minBedrooms, setMinBedrooms] = useState(
    searchParams.get("minBedrooms") ?? "",
  );
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") ?? "newest");

  const apply = () => {
    const params = new URLSearchParams();
    params.set("type", "rent");
    if (categories.length > 0) params.set("categories", categories.join(","));
    if (colonia) params.set("colonia", colonia);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (minBedrooms) params.set("minBedrooms", minBedrooms);
    if (sortBy && sortBy !== "newest") params.set("sortBy", sortBy);

    router.push(`/rentas?${params.toString()}`);
  };

  const reset = () => {
    setCategories([]);
    setColonia("");
    setMinPrice("");
    setMaxPrice("");
    setMinBedrooms("");
    setSortBy("newest");
    router.push("/rentas");
  };

  return (
    <div className="space-y-5 rounded-3xl border bg-card p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="rent-colonia">Colonia</Label>
          <Select value={colonia} onValueChange={(v) => setColonia(v ?? "")}>
            <SelectTrigger id="rent-colonia" className="rounded-full">
              <SelectValue placeholder="Cualquiera" />
            </SelectTrigger>
            <SelectContent>
              {colonias.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rent-min-price">Precio mín.</Label>
          <Input
            id="rent-min-price"
            type="number"
            inputMode="numeric"
            min="0"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="0"
            className="rounded-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rent-max-price">Precio máx.</Label>
          <Input
            id="rent-max-price"
            type="number"
            inputMode="numeric"
            min="0"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="100,000"
            className="rounded-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rent-bedrooms">Cuartos</Label>
          <Select
            value={minBedrooms}
            onValueChange={(v) => setMinBedrooms(v ?? "")}
          >
            <SelectTrigger id="rent-bedrooms" className="rounded-full">
              <SelectValue placeholder="Cualquiera" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1+</SelectItem>
              <SelectItem value="2">2+</SelectItem>
              <SelectItem value="3">3+</SelectItem>
              <SelectItem value="4">4+</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tipo de propiedad</Label>
        <CategoryPills
          id="rent-categories"
          selected={categories}
          onChange={setCategories}
        />
        <p className="text-xs text-muted-foreground">
          Selecciona uno o varios tipos; los listados mostrarán solo esos.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="rent-sort" className="shrink-0">
            Ordenar
          </Label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v ?? "newest")}>
            <SelectTrigger id="rent-sort" className="rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Más recientes</SelectItem>
              <SelectItem value="price_asc">Precio (menor → mayor)</SelectItem>
              <SelectItem value="price_desc">Precio (mayor → menor)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={reset}>
            Limpiar
          </Button>
          <Button onClick={apply}>Aplicar filtros</Button>
        </div>
      </div>
    </div>
  );
}
