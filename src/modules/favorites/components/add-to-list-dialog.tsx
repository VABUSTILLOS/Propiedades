"use client";

import { useRouter } from "next/navigation";
import { ListPlus, Loader2 } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";

import { addPropertyToLists, createList } from "@/modules/favorites/lists-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FavoriteListWithMeta } from "@/modules/favorites/lists-queries";

type Props = {
  propertyId: string;
  propertySlug?: string;
  /** The user's lists, used to render the checklist. */
  lists: FavoriteListWithMeta[];
  /** Ids of lists that already contain this property. */
  containingListIds: string[];
  /** Custom trigger element (e.g. an icon button in a row). */
  trigger?: ReactNode;
  /** Trigger content (default button when no `trigger` is given). */
  children?: ReactNode;
  className?: string;
};

/**
 * "Añadir a lista" dialog. Lets the user tick any of their lists (plus create
 * a new one on the fly). Adding always saves the property as a favorite too.
 * Anonymous visitors are redirected to /sign-up.
 */
export function AddToListDialog({
  propertyId,
  propertySlug,
  lists,
  containingListIds,
  trigger,
  children,
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set(containingListIds));
  const [newListName, setNewListName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const signUpNext = propertySlug
    ? `/sign-up?next=/property/${propertySlug}`
    : "/sign-up";

  const toggleOpen = (next: boolean) => {
    setOpen(next);
    if (next) {
      setChecked(new Set(containingListIds));
      setNewListName("");
      setError(null);
    }
  };

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const selected = new Set(checked);
      const name = newListName.trim();

      if (name) {
        const res = await createList({ name });
        if (!res.ok) {
          if (res.code === "AUTH_REQUIRED") {
            router.push(signUpNext);
            return;
          }
          setError(res.error);
          return;
        }
        selected.add(res.data.id);
      }

      const listIds = [...selected];
      if (listIds.length === 0) {
        setOpen(false);
        return;
      }

      const res = await addPropertyToLists({ propertyId, listIds });
      if (!res.ok) {
        if (res.code === "AUTH_REQUIRED") {
          router.push(signUpNext);
          return;
        }
        setError(res.error);
        return;
      }
      setOpen(false);
    });

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={toggleOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button type="button" className={className}>
            {children}
          </button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir a lista</DialogTitle>
          <DialogDescription>
            Marca las listas donde quieres guardar esta propiedad. Al añadirla
            también se guarda como favorito.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          {lists.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Todavía no tienes listas. Crea una abajo.
            </p>
          )}
          {lists.map((list) => {
            const active = checked.has(list.id);
            return (
              <label
                key={list.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                  active
                    ? "border-primary/50 bg-primary/5"
                    : "hover:bg-muted/50",
                )}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggle(list.id)}
                  className="size-4 accent-primary"
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
                  {list.itemCount}
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="Nombre de lista nueva"
            maxLength={80}
            aria-label="Nombre de lista nueva"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ListPlus className="size-4" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
