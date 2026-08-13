"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, TrendingUp, Heart, FileText } from "lucide-react";
import { Command } from "cmdk";

import { Dialog, DialogContent } from "@/components/ui/dialog";

/**
 * Global Cmd+K command palette: natural-language search and quick navigation.
 * Wired via the layout; opens on Cmd+K / Ctrl+K.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[15%] max-w-lg overflow-hidden p-0">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Command.Input
              placeholder="Busca en lenguaje natural… ej. casa con patio en zona segura"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={query}
              onValueChange={setQuery}
            />
            <kbd className="hidden rounded border bg-muted px-1.5 text-xs text-muted-foreground sm:block">
              ⌘K
            </kbd>
          </div>

          <Command.List className="max-h-72 overflow-y-auto p-1">
            {query.trim() ? (
              <Command.Group heading="Búsqueda semántica">
                <Command.Item
                  value="search"
                  onSelect={() =>
                    go(`/search?q=${encodeURIComponent(query.trim())}`)
                  }
                >
                  <Search className="size-4" />
                  <span className="ml-2">{query.trim()}</span>
                </Command.Item>
              </Command.Group>
            ) : null}

            <Command.Group heading="Ir a">
              <Command.Item value="investor" onSelect={() => go("/investor")}>
                <TrendingUp className="size-4" />
                <span className="ml-2">Modo inversionista: remates, flipping, traspasos</span>
              </Command.Item>
              <Command.Item value="favorites" onSelect={() => go("/favorites")}>
                <Heart className="size-4" />
                <span className="ml-2">Mis favoritos (Tier List)</span>
              </Command.Item>
              <Command.Item value="flyers" onSelect={() => go("/my-flyers")}>
                <FileText className="size-4" />
                <span className="ml-2">Mis flyers</span>
              </Command.Item>
              <Command.Item value="search" onSelect={() => go("/search")}>
                <Search className="size-4" />
                <span className="ml-2">Buscar propiedades</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
