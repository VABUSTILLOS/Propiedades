"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { handleTabListKeyDown } from "@/lib/a11y";

const TYPE_TABS = [
  { value: "", label: "Comprar" },
  { value: "rent", label: "Rentar" },
];

/**
 * Prominent hero search bar (Bali Listings pattern): segmented type tabs
 * sit above the white search card. Submits to /search with the same
 * query params the search page understands (query, type, city).
 */
export function HeroSearch({ cities }: { cities: string[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [city, setCity] = useState("");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (type) params.set("type", type);
    if (city) params.set("city", city);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="w-full">
      {/* Segmented type tabs (Bali Listings style) */}
      <div
        role="tablist"
        aria-label="Tipo de búsqueda"
        onKeyDown={handleTabListKeyDown}
        className="mb-1.5 inline-flex items-center gap-0.5 rounded-full border border-white/25 bg-white/10 p-0.5 backdrop-blur-sm"
      >
        {TYPE_TABS.map((tab) => {
          const active = type === tab.value;
          return (
            <button
              key={tab.label}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => setType(tab.value)}
              className={cn(
                "relative rounded-full px-3.5 py-1 text-xs font-semibold transition-colors",
                active ? "text-copper-ink" : "text-white/85 hover:text-white",
              )}
            >
              {active && (
                <motion.span
                  layoutId="hero-type-tab"
                  className="absolute inset-0 rounded-full bg-white shadow-sm"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <form
        onSubmit={submit}
        className="flex w-full flex-col gap-1 rounded-3xl border border-white/50 bg-white p-1 shadow-2xl shadow-[#2A1508]/30 sm:flex-row sm:items-center sm:rounded-full"
      >
        <Select value={city} onValueChange={(value) => setCity(value ?? "")}>
          <SelectTrigger className="h-8 w-full justify-between border-0 bg-transparent shadow-none sm:w-40">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4" />
              <SelectValue placeholder="¿En qué ciudad?" />
            </span>
          </SelectTrigger>
          <SelectContent>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="hidden h-5 w-px shrink-0 bg-border sm:block" />

        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Colonia, keywords, descripción…"
          className="h-8 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
        />

        <Button
          type="submit"
          className="shrink-0 self-end rounded-full px-4 sm:size-9 sm:shrink-0 sm:justify-center sm:p-0"
        >
          <Search className="size-4" />
          <span className="sm:hidden">Buscar</span>
        </Button>
      </form>
    </div>
  );
}
