"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Prominent hero search bar. Submits to /search with the same
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
    <form
      onSubmit={submit}
      className="flex w-full flex-col gap-2 rounded-[2rem] border border-white/50 bg-white p-2 shadow-2xl shadow-[#2A1508]/30 sm:flex-row sm:items-center"
    >
      <Select value={type} onValueChange={(value) => setType(value ?? "")}>
        <SelectTrigger className="w-full justify-between border-0 bg-transparent shadow-none sm:w-44">
          <SelectValue placeholder="Venta o renta" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sale">Comprar</SelectItem>
          <SelectItem value="rent">Rentar</SelectItem>
        </SelectContent>
      </Select>

      <div className="hidden h-9 w-px shrink-0 bg-border sm:block" />

      <Select value={city} onValueChange={(value) => setCity(value ?? "")}>
        <SelectTrigger className="w-full justify-between border-0 bg-transparent shadow-none sm:w-52">
          <SelectValue placeholder="¿En qué ciudad?" />
        </SelectTrigger>
        <SelectContent>
          {cities.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="hidden h-9 w-px shrink-0 bg-border sm:block" />

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Colonia, keywords, descripción…"
        className="h-10 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
      />

      <Button
        type="submit"
        size="lg"
        className="shrink-0 self-end rounded-full px-5 sm:size-14 sm:shrink-0 sm:justify-center sm:p-0"
      >
        <Search className="size-5" />
        <span className="sm:hidden">Buscar</span>
      </Button>
    </form>
  );
}
