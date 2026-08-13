"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BedroomsSlider,
  MAX_BEDROOMS,
} from "@/modules/search/components/bedrooms-slider";
import { CategoryPills } from "@/modules/search/components/category-pills";
import {
  PriceRangeSlider,
  RENT_PRICE_MAX,
} from "@/modules/search/components/price-range-slider";
import { parseCategoriesParam } from "@/modules/lib/schemas";
import type { PropertyCategory } from "@/modules/lib/database.types";

interface RentFiltersState {
  categories: PropertyCategory[];
  colonia: string;
  minPrice: string;
  maxPrice: string;
  minBedrooms: string;
  sortBy: string;
}

/**
 * Real-time filters for the /rentas page. Every change navigates to
 * /rentas?<params> immediately (debounced for text inputs), re-rendering the
 * server-side results grid without an "Aplicar filtros" step.
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

  // Mirror of the current filter state used to build URLs even before React
  // re-renders, so rapid changes and debounced inputs stay in sync.
  const stateRef = useRef<RentFiltersState>({
    categories,
    colonia,
    minPrice,
    maxPrice,
    minBedrooms,
    sortBy,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending debounced navigation when the form unmounts, so leaving
  // the page mid-typing doesn't bounce the user back to /rentas.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const buildParams = (next: RentFiltersState) => {
    const params = new URLSearchParams();
    params.set("type", "rent");
    if (next.categories.length > 0) params.set("categories", next.categories.join(","));
    if (next.colonia) params.set("colonia", next.colonia);
    if (next.minPrice) params.set("minPrice", next.minPrice);
    if (next.maxPrice) params.set("maxPrice", next.maxPrice);
    if (next.minBedrooms) params.set("minBedrooms", next.minBedrooms);
    if (next.sortBy && next.sortBy !== "newest") params.set("sortBy", next.sortBy);
    return params;
  };

  // Navigates to /rentas with the given filter state, replacing the URL so the
  // server re-renders results without pushing history entries.
  const navigate = (next: RentFiltersState) => {
    router.replace(`/rentas?${buildParams(next).toString()}`, { scroll: false });
  };

  // Applies a filter change immediately (selects, pills, sort).
  const changeImmediate = (patch: Partial<RentFiltersState>) => {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(next);
  };

  const priceStep = 5_000;

  // Slider reflects the URL range; empty params mean "no limit" → extremes.
  const priceRange: [number, number] = [
    Math.min(Number(minPrice) || 0, RENT_PRICE_MAX),
    Math.min(Number(maxPrice) || RENT_PRICE_MAX, RENT_PRICE_MAX),
  ];

  // During drag only the local state (and the live label) updates; the URL is
  // updated once on commit so we don't spam server re-renders mid-gesture.
  const handlePriceChange = (next: [number, number]) => {
    const nextMin = next[0] > 0 ? String(next[0]) : "";
    const nextMax = next[1] < RENT_PRICE_MAX ? String(next[1]) : "";
    setMinPrice(nextMin);
    setMaxPrice(nextMax);
    stateRef.current = { ...stateRef.current, minPrice: nextMin, maxPrice: nextMax };
  };

  const handlePriceCommitted = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(stateRef.current);
  };

  // Slider reflects the URL value; empty param means "no minimum" → 0.
  const bedroomsValue = Math.min(
    Math.max(Number(minBedrooms) || 0, 0),
    MAX_BEDROOMS,
  );

  // During drag only the local state (and the live label) updates; the URL is
  // updated once on commit so we don't spam server re-renders mid-gesture.
  const handleBedroomsChange = (next: number) => {
    const nextStr = next > 0 ? String(next) : "";
    setMinBedrooms(nextStr);
    stateRef.current = { ...stateRef.current, minBedrooms: nextStr };
  };

  const handleBedroomsCommitted = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(stateRef.current);
  };

  const reset = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCategories([]);
    setColonia("");
    setMinPrice("");
    setMaxPrice("");
    setMinBedrooms("");
    setSortBy("newest");
    stateRef.current = {
      categories: [],
      colonia: "",
      minPrice: "",
      maxPrice: "",
      minBedrooms: "",
      sortBy: "newest",
    };
    router.replace("/rentas", { scroll: false });
  };

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="rent-colonia">Colonia</Label>
          <Select
            value={colonia}
            onValueChange={(v) => {
              const next = v ?? "";
              setColonia(next);
              changeImmediate({ colonia: next });
            }}
          >
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

        <div className="space-y-1.5">
          <Label className="text-xs">Recámaras</Label>
          <BedroomsSlider
            value={bedroomsValue}
            onChange={handleBedroomsChange}
            onCommitted={handleBedroomsCommitted}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Precio</Label>
        <PriceRangeSlider
          min={0}
          max={RENT_PRICE_MAX}
          step={priceStep}
          value={priceRange}
          onChange={handlePriceChange}
          onCommitted={handlePriceCommitted}
        />
        <p className="text-xs text-muted-foreground">
          Arrastra los controles para ajustar el rango de renta.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Tipo de propiedad</Label>
        <CategoryPills
          id="rent-categories"
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className="shrink-0 text-xs" htmlFor="rent-sort">
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
            <SelectTrigger id="rent-sort" className="rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Más recientes</SelectItem>
              <SelectItem value="price_asc">Precio (menor → mayor)</SelectItem>
              <SelectItem value="price_desc">Precio (mayor → menor)</SelectItem>
              <SelectItem value="m2_const_asc">
                Precio/m² construido (menor → mayor)
              </SelectItem>
              <SelectItem value="m2_const_desc">
                Precio/m² construido (mayor → menor)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={reset}>
            Limpiar
          </Button>
        </div>
      </div>
    </div>
  );
}
