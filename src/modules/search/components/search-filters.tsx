"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

interface SearchFilterState {
  query: string;
  type: string;
  categories: PropertyCategory[];
  city: string;
  minPrice: string;
  maxPrice: string;
  sortBy: string;
}

/**
 * Real-time search filters for /search. Every change navigates to
 * /search?<params> immediately (debounced for text inputs), re-rendering the
 * server-side results grid without an "Aplicar filtros" step.
 */
export function SearchFiltersForm({ cities }: { cities: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const [type, setType] = useState(searchParams.get("type") ?? "");
  // Multi-select property types. Initialized from the CSV `categories` param,
  // falling back to the legacy single `category` for old URLs.
  const [categories, setCategories] = useState<PropertyCategory[]>(() => {
    const csv = searchParams.get("categories");
    if (csv) return parseCategoriesParam(csv);
    return parseCategoriesParam(searchParams.get("category"));
  });
  const [city, setCity] = useState(searchParams.get("city") ?? "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") ?? "newest");

  // Mirror of the current filter state used to build URLs even before React
  // re-renders, so rapid changes and debounced inputs stay in sync.
  const stateRef = useRef<SearchFilterState>({
    query,
    type,
    categories,
    city,
    minPrice,
    maxPrice,
    sortBy,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending debounced navigation when the form unmounts, so leaving
  // the page mid-typing doesn't bounce the user back to /search.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const buildParams = (next: SearchFilterState) => {
    const params = new URLSearchParams();
    if (next.query.trim()) params.set("query", next.query.trim());
    if (next.type) params.set("type", next.type);
    if (next.categories.length > 0) params.set("categories", next.categories.join(","));
    if (next.city) params.set("city", next.city);
    if (next.minPrice) params.set("minPrice", next.minPrice);
    if (next.maxPrice) params.set("maxPrice", next.maxPrice);
    if (next.sortBy && next.sortBy !== "newest") params.set("sortBy", next.sortBy);
    return params;
  };

  // Navigates to /search with the given filter state, replacing the URL so the
  // server re-renders results without pushing history entries.
  const navigate = (next: SearchFilterState) => {
    router.replace(`/search?${buildParams(next).toString()}`, { scroll: false });
  };

  // Applies a filter change immediately (selects, pills, sort).
  const changeImmediate = (patch: Partial<SearchFilterState>) => {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(next);
  };

  // Applies a filter change after a short pause (text/number inputs).
  const changeDebounced = (patch: Partial<SearchFilterState>) => {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate(next), 400);
  };

  const reset = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery("");
    setType("");
    setCategories([]);
    setCity("");
    setMinPrice("");
    setMaxPrice("");
    setSortBy("newest");
    stateRef.current = {
      query: "",
      type: "",
      categories: [],
      city: "",
      minPrice: "",
      maxPrice: "",
      sortBy: "newest",
    };
    router.replace("/search", { scroll: false });
  };

  return (
    <div className="space-y-5 rounded-3xl border bg-card p-5 shadow-sm">
      <div className="space-y-2">
        <Label htmlFor="search-query">Buscar</Label>
        <Input
          id="search-query"
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            changeDebounced({ query: next });
          }}
          placeholder="Título, descripción, colonia, ciudad…"
          className="rounded-full"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="search-type">Tipo</Label>
          <Select
            value={type}
            onValueChange={(v) => {
              const next = v ?? "";
              setType(next);
              changeImmediate({ type: next });
            }}
          >
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
          <Label htmlFor="search-city">Ciudad</Label>
          <Select
            value={city}
            onValueChange={(v) => {
              const next = v ?? "";
              setCity(next);
              changeImmediate({ city: next });
            }}
          >
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
            onChange={(e) => {
              const next = e.target.value;
              setMinPrice(next);
              changeDebounced({ minPrice: next });
            }}
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
            onChange={(e) => {
              const next = e.target.value;
              setMaxPrice(next);
              changeDebounced({ maxPrice: next });
            }}
            placeholder="10,000,000"
            className="rounded-full"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tipo de propiedad</Label>
        <CategoryPills
          id="search-categories"
          selected={categories}
          onChange={(next) => {
            setCategories(next);
            changeImmediate({ categories: next });
          }}
        />
        <p className="text-xs text-muted-foreground">
          Selecciona uno o varios tipos; los listados mostrarán solo esos.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="search-sort" className="shrink-0">
            Ordenar
          </Label>
          <Select
            value={sortBy}
            onValueChange={(v) => {
              const next = v ?? "newest";
              setSortBy(next);
              changeImmediate({ sortBy: next });
            }}
          >
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
        </div>
      </div>
    </div>
  );
}
