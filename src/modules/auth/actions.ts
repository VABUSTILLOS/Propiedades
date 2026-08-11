"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/modules/lib/action-result";
import { parseInput } from "@/modules/lib/action-result";
import {
  forgotPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/modules/lib/schemas";

/**
 * Server Actions for Supabase Auth.
 * All inputs are Zod-validated before hitting the auth API.
 */

export async function signIn(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseInput(
    signInSchema,
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUp(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseInput(signUpSchema, Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const { fullName, email, password, role } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role },
    },
  });

  if (error) {
    return fail(error.message);
  }

  // A new profile row is created by the `on_auth_user_created` trigger
  // (see migration 002). If email confirmation is enabled the user must
  // confirm before the trigger fires; redirect to a "check your email" page.
  if (!data.session) {
    redirect("/sign-up/check-email");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut(): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function sendPasswordReset(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseInput(
    forgotPasswordSchema,
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/update-password`,
  });

  if (error) {
    return fail(error.message);
  }

  return ok(undefined);
}
