"use client";

import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { removeFromList } from "@/modules/favorites/lists-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  WhatsAppIcon,
} from "@/modules/chat/components/share-whatsapp-button";
import { buildWhatsAppConsolidatedShareLink } from "@/modules/chat/share";
import { useSiteUrl } from "@/modules/chat/components/use-site-url";
import type {
  FavoriteListItemWithProperty,
  FavoriteListWithMeta,
} from "@/modules/favorites/lists-queries";

type Props = {
  list: FavoriteListWithMeta;
  items: FavoriteListItemWithProperty[];
};

export function ListDetailView({ list, items }: Props) {
  const siteUrl = useSiteUrl();
  const [localItems, setLocalItems] = useState(items);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const shareable = localItems
    .map((i) => i.property)
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const shareHref =
    shareable.length > 0
      ? buildWhatsAppConsolidatedShareLink(
          shareable.map((p) => ({
            title: p.title,
            colonia: p.colonia,
            city: p.city,
            price: p.price,
            currency: p.currency,
            slug: p.slug,
          })),
          siteUrl,
        )
      : undefined;

  const remove = (favoriteId: string) =>
    startTransition(async () => {
      setError(null);
      const res = await removeFromList({ listId: list.id, favoriteId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLocalItems((prev) => prev.filter((i) => i.favorite_id !== favoriteId));
    });

  return (
    <div>
      <Link
        href="/favorites"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="size-4" />
        Volver a favoritos
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{list.name}</h1>
          {list.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {list.description}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {localItems.length}{" "}
            {localItems.length === 1 ? "propiedad" : "propiedades"}
          </p>
        </div>
        {shareHref && (
          <a
            href={shareHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Compartir ${list.name} por WhatsApp`}
            className="mt-4 inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
          >
            <WhatsAppIcon className="size-4" />
            Compartir por WhatsApp
          </a>
        )}
      </div>

      {error && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {localItems.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Esta lista está vacía. Agrega propiedades desde su página o desde
            tus favoritos.
          </p>
          <Link
            href="/search"
            className={buttonVariants({ className: "mt-4" })}
          >
            Buscar propiedades
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {localItems.map((item) => {
            const property = item.property;
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-2.5"
              >
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                  {property?.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={property.images[0]}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                      Sin imagen
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {property ? (
                    <>
                      <Link
                        href={`/property/${property.slug}`}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {property.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {property.city} · ${property.price.toLocaleString()}{" "}
                        {property.currency}
                      </p>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Propiedad ya no disponible
                    </span>
                  )}
                </div>

                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => remove(item.favorite_id)}
                  aria-label="Quitar de la lista"
                  className={cn(
                    "text-muted-foreground hover:text-destructive",
                  )}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
