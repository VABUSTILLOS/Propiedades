import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Check your email" };

/**
 * Post-sign-up confirmation screen. `signUp()` redirects here when email
 * confirmation is enabled and no session was returned yet.
 */
export default function CheckEmailPage() {
  return (
    <div className="space-y-6 text-center">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent you a confirmation link. Click it to activate your account,
          then sign in to get started.
        </p>
      </div>
      <Link href="/sign-in" className={buttonVariants({ className: "w-full" })}>
        Go to sign in
      </Link>
    </div>
  );
}
