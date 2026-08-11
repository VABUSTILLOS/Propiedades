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
  const [city, setCity] = useState(searchParams.get("city") ?? "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") ?? "newest");

  const apply = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (type) params.set("type", type);
    if (city) params.set("city", city);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (sortBy && sortBy !== "newest") params.set("sortBy", sortBy);

    router.push(`/search?${params.toString()}`);
  };

  const reset = () => {
    setQuery("");
    setType("");
    setCity("");
    setMinPrice("");
    setMaxPrice("");
    setSortBy("newest");
    router.push("/search");
  };

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="space-y-2">
        <Label htmlFor="search-query">Search</Label>
        <Input
          id="search-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Title, description, colonia, city…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="search-type">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v ?? "")}>
            <SelectTrigger id="search-type">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sale">For sale</SelectItem>
              <SelectItem value="rent">For rent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="search-city">City</Label>
          <Select value={city} onValueChange={(v) => setCity(v ?? "")}>
            <SelectTrigger id="search-city">
              <SelectValue placeholder="Any" />
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
          <Label htmlFor="search-min-price">Min price</Label>
          <Input
            id="search-min-price"
            type="number"
            inputMode="numeric"
            min="0"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="search-max-price">Max price</Label>
          <Input
            id="search-max-price"
            type="number"
            inputMode="numeric"
            min="0"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="10000000"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="search-sort" className="shrink-0">
            Sort
          </Label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v ?? "newest")}>
            <SelectTrigger id="search-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price (low → high)</SelectItem>
              <SelectItem value="price_desc">Price (high → low)</SelectItem>
              <SelectItem value="score">Top score</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={reset}>
            Reset
          </Button>
          <Button onClick={apply}>Apply filters</Button>
        </div>
      </div>
    </div>
  );
}
