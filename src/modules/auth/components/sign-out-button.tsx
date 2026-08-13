"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";

import { signOut } from "@/modules/auth/actions";
import { buttonVariants } from "@/components/ui/button";

/**
 * Signs the current user out by invoking the `signOut` server action.
 * The action redirects to `/` on success, so no local navigation is needed.
 */
export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={buttonVariants({ variant: "ghost" })}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await signOut();
          if (result && !result.ok) {
            console.error("Error al cerrar sesión:", result.error);
          }
        })
      }
    >
      <LogOut />
      {pending ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
