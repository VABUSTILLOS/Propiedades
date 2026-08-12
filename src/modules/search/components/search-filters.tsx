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

/**
 * GET-form search filters. Submitting navigates to /search?<params>,
 * which re-renders the server-side results grid.
 */
export function SearchFiltersForm({ cities }: { cities: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const [type, setType] = useState(searchParams.get("type") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [city, setCity] = useState(searchParams.get("city") ?? "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") ?? "newest");

  const apply = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (type) params.set("type", type);
    if (category) params.set("category", category);
    if (city) params.set("city", city);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (sortBy && sortBy !== "newest") params.set("sortBy", sortBy);

    router.push(`/search?${params.toString()}`);
  };

  const reset = () => {
    setQuery("");
    setType("");
    setCategory("");
    setCity("");
    setMinPrice("");
    setMaxPrice("");
    setSortBy("newest");
    router.push("/search");
  };

  return (
    <div className="space-y-5 rounded-3xl border bg-card p-5 shadow-sm">
      <div className="space-y-2">
        <Label htmlFor="search-query">Buscar</Label>
        <Input
          id="search-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Título, descripción, colonia, ciudad…"
          className="rounded-full"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="search-type">Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v ?? "")}>
            <SelectTrigger id="search-type" className="rounded-full">
              <SelectValue placeholder="Cualquiera" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sale">En venta</SelectItem>
              <SelectItem value="rent">En renta</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="search-category">Categoría</Label>
          <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
            <SelectTrigger id="search-category" className="rounded-full">
              <SelectValue placeholder="Cualquiera" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="casa">Casa</SelectItem>
              <SelectItem value="departamento">Departamento</SelectItem>
              <SelectItem value="local">Local</SelectItem>
              <SelectItem value="bodega">Bodega</SelectItem>
              <SelectItem value="terreno">Terreno</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="search-city">Ciudad</Label>
          <Select value={city} onValueChange={(v) => setCity(v ?? "")}>
            <SelectTrigger id="search-city" className="rounded-full">
              <SelectValue placeholder="Cualquiera" />
            </SelectTrigger>
            <SelectContent>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="search-min-price">Precio mín.</Label>
          <Input
            id="search-min-price"
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
          <Label htmlFor="search-max-price">Precio máx.</Label>
          <Input
            id="search-max-price"
            type="number"
            inputMode="numeric"
            min="0"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="10,000,000"
            className="rounded-full"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="search-sort" className="shrink-0">
            Ordenar
          </Label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v ?? "newest")}>
            <SelectTrigger id="search-sort" className="rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Más recientes</SelectItem>
              <SelectItem value="hot">Más hot (oportunidad)</SelectItem>
              <SelectItem value="price_asc">Precio (menor → mayor)</SelectItem>
              <SelectItem value="price_desc">Precio (mayor → menor)</SelectItem>
              <SelectItem value="score">Mejor score</SelectItem>
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
