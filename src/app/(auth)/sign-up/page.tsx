import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "@/modules/auth/components/sign-up-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          Propiedades
        </Link>
        <h1 className="text-lg font-semibold">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Buy, invest, list, or sell — your way.
        </p>
      </div>
      <SignUpForm />
    </div>
  );
}
