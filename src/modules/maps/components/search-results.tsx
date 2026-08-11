"use client";

import { useState } from "react";
import { List, Map as MapIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ListingsMap, type MapMarker } from "@/modules/maps/components/listings-map";

export type ResultCardProps = {
  id: string;
  title: string;
  slug: string;
  city: string;
  price: number;
  currency: string;
  type: "sale" | "rent";
  image: string | null;
  score: number | null;
  lat: number | null;
  lng: number | null;
};

/**
 * Client wrapper toggling between the result grid and a map view.
 */
export function SearchResults({
  children,
  results,
}: {
  children: React.ReactNode;
  results: ResultCardProps[];
}) {
  const [view, setView] = useState<"list" | "map">("list");

  const markers: MapMarker[] = results
    .filter((r) => r.lat !== null && r.lng !== null)
    .map((r) => ({
      id: r.id,
      title: r.title,
      lat: r.lat as number,
      lng: r.lng as number,
      price: r.price,
    }));

  return (
    <div className="space-y-4">
      {results.length > 0 && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant={view === "list" ? "secondary" : "outline"}
            onClick={() => setView("list")}
          >
            <List className="mr-2 size-4" /> List
          </Button>
          <Button
            size="sm"
            variant={view === "map" ? "secondary" : "outline"}
            onClick={() => setView("map")}
            className="ml-2"
          >
            <MapIcon className="mr-2 size-4" /> Map
          </Button>
        </div>
      )}
      {view === "map" && markers.length > 0 ? (
        <ListingsMap markers={markers} />
      ) : view === "map" && results.length > 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
          No listings have coordinates to display.
        </div>
      ) : (
        children
      )}
    </div>
  );
}
