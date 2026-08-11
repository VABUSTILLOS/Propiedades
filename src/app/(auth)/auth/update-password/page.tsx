import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { UpdatePasswordForm } from "@/modules/auth/components/update-password-form";

export const metadata: Metadata = {
  title: "Set a new password",
  description: "Choose a new password for your account.",
};

export default function UpdatePasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          Propiedades
        </Link>
        <h1 className="text-lg font-semibold">Set a new password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a new password for your account.
        </p>
      </div>
      <Suspense
        fallback={
          <p className="py-8 text-center text-sm text-muted-foreground">
            Verifying reset link…
          </p>
        }
      >
        <UpdatePasswordForm />
      </Suspense>
    </div>
  );
}
