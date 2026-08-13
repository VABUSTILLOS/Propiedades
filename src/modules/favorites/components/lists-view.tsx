"use client";

import Link from "next/link";
import { ListPlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { createList, deleteList, updateList } from "@/modules/favorites/lists-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FavoriteListWithMeta } from "@/modules/favorites/lists-queries";

type Props = {
  lists: FavoriteListWithMeta[];
};

export function ListsView({ lists }: Props) {
  const [editing, setEditing] = useState<FavoriteListWithMeta | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setError(null);
    setIsCreating(true);
  };

  const openEdit = (list: FavoriteListWithMeta) => {
    setEditing(list);
    setName(list.name);
    setDescription(list.description ?? "");
    setError(null);
    setIsCreating(true);
  };

  const close = () => {
    setIsCreating(false);
    setEditing(null);
  };

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = editing
        ? await updateList({
            listId: editing.id,
            name,
            description: description || undefined,
          })
        : await createList({ name, description: description || undefined });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      close();
    });

  const remove = (list: FavoriteListWithMeta) => {
    if (!window.confirm(`¿Eliminar la lista "${list.name}"?`)) return;
    startTransition(async () => {
      setError(null);
      const res = await deleteList(list.id);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div>
      {error && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mb-6 flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Nueva lista
        </Button>
      </div>

      {lists.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Crea listas para organizar tus propiedades favoritas — por ejemplo
            &ldquo;Casas en Cancún&rdquo; o &ldquo;Para rentar&rdquo;.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {lists.map((list) => (
            <li
              key={list.id}
              className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <Link
                href={`/favorites/lists/${list.id}`}
                className="block"
                aria-label={`Abrir lista ${list.name}`}
              >
                <PreviewStrip preview={list.preview} />
                <h3 className="mt-3 truncate text-sm font-semibold">
                  {list.name}
                </h3>
                {list.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {list.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {list.itemCount}{" "}
                  {list.itemCount === 1 ? "propiedad" : "propiedades"}
                </p>
              </Link>

              <div className="mt-3 flex items-center gap-1 border-t pt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => openEdit(list)}
                  disabled={isPending}
                >
                  <Pencil className="size-3.5" />
                  Renombrar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-destructive hover:text-destructive"
                  onClick={() => remove(list)}
                  disabled={isPending}
                >
                  <Trash2 className="size-3.5" />
                  Eliminar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={isCreating} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Renombrar lista" : "Nueva lista"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Actualiza el nombre o la descripción de tu lista."
                : "Agrupa propiedades que quieras comparar o seguir juntas."}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="space-y-3">
            <div>
              <label
                htmlFor="list-name"
                className="mb-1 block text-sm font-medium"
              >
                Nombre
              </label>
              <Input
                id="list-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Ej. Casas en Cancún"
              />
            </div>
            <div>
              <label
                htmlFor="list-description"
                className="mb-1 block text-sm font-medium"
              >
                Descripción <span className="text-muted-foreground">(opcional)</span>
              </label>
              <Textarea
                id="list-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Notas para recordar por qué agrupaste estas propiedades."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={close}
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
              {editing ? "Guardar cambios" : "Crear lista"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewStrip({
  preview,
}: {
  preview: FavoriteListWithMeta["preview"];
}) {
  if (preview.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md border border-dashed bg-muted/30">
        <ListPlus className="size-5 text-muted-foreground" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "grid h-24 gap-1 overflow-hidden rounded-md",
        preview.length === 1 ? "grid-cols-1" : "grid-cols-2",
      )}
    >
      {preview.map((p, index) => (
        <div
          key={p.id}
          className={cn(
            "relative overflow-hidden bg-muted",
            preview.length > 2 && index === 0 && "col-span-2",
          )}
        >
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imageUrl}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center px-2">
              <span className="line-clamp-3 text-center text-xs text-muted-foreground">
                {p.title}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
