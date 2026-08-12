"use client";

import { useState, type ReactElement } from "react";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSiteUrl } from "@/modules/chat/components/use-site-url";
import { buildWhatsAppConsolidatedShareLink } from "@/modules/chat/share";
import { WhatsAppIcon } from "@/modules/chat/components/share-whatsapp-button";
import { cn } from "@/lib/utils";
import type { FavoriteWithProperty } from "@/modules/favorites/queries";
import type { ListWithItems } from "@/modules/favorites/lists-queries";
import type { ChatResult } from "@/modules/chat/types";

type Props = {
  favorites: FavoriteWithProperty[];
  /** Lists together with all their items (property joined). */
  listsWithItems: ListWithItems[];
  /** Custom trigger element (default: outlined WhatsApp button). */
  trigger?: ReactElement;
};

/**
 * "Compartir por WhatsApp" dialog for the consolidated favorites view.
 * Lets the user tick any combination of their favorite properties and lists,
 * then opens a single prefabricated WhatsApp share link with every selected
 * property. Selecting a list selects all of its items (deduplicated by
 * property id).
 */
export function ShareFavoritesDialog({ favorites, listsWithItems, trigger }: Props) {
  const siteUrl = useSiteUrl();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // property_id -> minimal shape the share builder understands.
  const propertyById = new Map<string, ChatResult>();
  for (const favorite of favorites) {
    if (!favorite.property) continue;
    propertyById.set(favorite.property_id, toShareProperty(favorite.property));
  }
  for (const { items } of listsWithItems) {
    for (const item of items) {
      propertyById.set(item.id, {
        id: item.id,
        slug: item.slug,
        title: item.title,
        city: item.city,
        colonia: "",
        price: item.price,
        currency: item.currency,
        type: "sale",
        image: item.images?.[0] ?? null,
        score: null,
        recamaras: null,
        banos: null,
        estacionamientos: null,
        antiguedad: null,
        construccion_m2: 0,
        terreno_m2: 0,
      });
    }
  }

  const selectedProperties = [...selected]
    .map((id) => propertyById.get(id))
    .filter((p): p is ChatResult => Boolean(p));

  const toggleOpen = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Pre-select everything so "share all" is one click.
      setSelected(new Set(propertyById.keys()));
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleList = (listId: string) => {
    const itemIds = listsWithItems.find((l) => l.list.id === listId)?.items.map((i) => i.id) ?? [];
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = itemIds.every((id) => next.has(id));
      for (const id of itemIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const listItemIds = new Map<string, Set<string>>();
  for (const { list, items } of listsWithItems) {
    listItemIds.set(
      list.id,
      new Set(items.map((i) => i.id)),
    );
  }

  const shareHref = buildWhatsAppConsolidatedShareLink(
    selectedProperties.map((p) => ({
      title: p.title,
      colonia: p.colonia,
      city: p.city,
      price: p.price,
      currency: p.currency,
      slug: p.slug,
      image: p.image ?? null,
    })),
    siteUrl,
  );

  return (
    <Dialog open={open} onOpenChange={toggleOpen}>
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger
          render={
            <Button variant="outline" size="sm">
              <MessageCircle className="size-4" />
              Compartir por WhatsApp
            </Button>
          }
        />
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartir por WhatsApp</DialogTitle>
          <DialogDescription>
            Marca las propiedades y listas que quieres incluir. Se genera un
            solo mensaje con todas las seleccionadas.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-5 overflow-y-auto pr-1">
          {favorites.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">
                Tus favoritos ({favorites.length})
              </h3>
              <ul className="space-y-1.5">
                {favorites.map((favorite) => {
                  const property = favorite.property;
                  const active = selected.has(favorite.property_id);
                  return (
                    <li key={favorite.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                          active
                            ? "border-primary/50 bg-primary/5"
                            : "hover:bg-muted/50",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggle(favorite.property_id)}
                          className="size-4 accent-primary"
                          disabled={!property}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {property?.title ?? "Propiedad no disponible"}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {property
                              ? `${property.city} · $${property.price.toLocaleString()} ${property.currency}`
                              : "—"}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {listsWithItems.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">
                Tus listas ({listsWithItems.length})
              </h3>
              <ul className="space-y-1.5">
                {listsWithItems.map(({ list, items }) => {
                  const itemIds = listItemIds.get(list.id) ?? new Set<string>();
                  const active =
                    itemIds.size > 0 &&
                    [...itemIds].every((id) => selected.has(id));
                  return (
                    <li key={list.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                          active
                            ? "border-primary/50 bg-primary/5"
                            : "hover:bg-muted/50",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleList(list.id)}
                          className="size-4 accent-primary"
                          disabled={items.length === 0}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {list.name}
                          </span>
                          {list.description && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {list.description}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {items.length} {items.length === 1 ? "propiedad" : "propiedades"}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        {selectedProperties.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedProperties.length}{" "}
            {selectedProperties.length === 1 ? "propiedad" : "propiedades"}{" "}
            seleccionadas.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <a
            href={selectedProperties.length > 0 ? shareHref : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={selectedProperties.length === 0}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
              "bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90",
              selectedProperties.length === 0 &&
                "pointer-events-none opacity-50",
            )}
          >
            <WhatsAppIcon className="size-4" />
            Compartir
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toShareProperty(property: NonNullable<FavoriteWithProperty["property"]>): ChatResult {
  return {
    id: property.id,
    slug: property.slug,
    title: property.title,
    city: property.city,
    colonia: property.colonia,
    price: property.price,
    currency: property.currency,
    type: property.type,
    image: property.images?.[0] ?? null,
    score: property.property_score,
    recamaras: property.recamaras,
    banos: property.banos,
    estacionamientos: property.estacionamientos,
    antiguedad: property.antiguedad,
    construccion_m2: property.construccion_m2,
    terreno_m2: property.terreno_m2,
  };
}
