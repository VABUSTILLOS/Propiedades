import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SignInForm } from "@/modules/auth/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          Propiedades
        </Link>
        <h1 className="text-lg font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to manage your listings and inquiries.
        </p>
      </div>
      <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
