"use client";

import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { toggleEditorMode } from "@/modules/admin/editor-mode";

/**
 * Master-user (admin) "Modo editor" toggle. When enabled, property cards and
 * the detail page reveal "Editar" links into the admin wizard. The flag is a
 * per-browser cookie set by the server action; after toggling we refresh so
 * the server components re-render with the new affordances.
 */
export function EditorModeToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      const res = await toggleEditorMode();
      if (res.ok) router.refresh();
    });
  };

  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      disabled={isPending}
      onClick={toggle}
      aria-pressed={active}
    >
      <Pencil className="size-4" />
      {active ? "Salir del modo editor" : "Modo editor"}
    </Button>
  );
}
