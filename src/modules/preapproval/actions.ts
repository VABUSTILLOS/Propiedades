"use server";

import { revalidatePath } from "next/cache";

import { requireUserOrThrow } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { fail, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import { preapprovalDataSchema } from "@/modules/lib/schemas";
import { searchListings } from "@/modules/search/queries";
import type { Json } from "@/modules/lib/database.types";

export type PreapprovalResult = {
  infonavit_nss: string | null;
  max_credit: number;
  bank_preapproved: boolean;
  bank_name: string | null;
  monthly_payment_estimate: number;
  matches: Array<{
    id: string;
    slug: string;
    title: string;
    city: string;
    colonia: string;
    price: number;
    currency: string;
    image: string | null;
    monthly_payment: number;
  }>;
};

const DEFAULT_RATE = 0.1049;
const DEFAULT_TERM_YEARS = 20;
const DOWN_PAYMENT_PCT = 0.2;

/**
 * Run the Infonavit/bank preapproval calculator, persist it to the profile,
 * and return smart-matched listings within the approved budget.
 */
export async function submitPreapproval(
  input: Record<string, unknown>,
): Promise<ActionResult<PreapprovalResult>> {
  const user = await requireUserOrThrow();
  const parsed = parseInput(preapprovalDataSchema, input);
  if (!parsed.success) return fail(parsed.error, parsed.fieldErrors);

  const data = parsed.data;

  // Simple affordability model: max credit ≈ 2.5× annual household income.
  // In production this is replaced by real Infonavit NSS lookup + bank score.
  const incomePerMonth = typeof input.monthlyIncome === "number" ? input.monthlyIncome : 0;
  const maxCredit =
    incomePerMonth > 0 ? Math.round(incomePerMonth * 12 * 2.5) : data.max_credit;

  // Monthly payment estimate at the approved credit, excluding down payment.
  const monthlyRate = DEFAULT_RATE / 12;
  const n = DEFAULT_TERM_YEARS * 12;
  const monthlyPaymentEstimate =
    monthlyRate === 0 || n === 0
      ? 0
      : (maxCredit * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      preapproval_data: {
        infonavit_nss: data.infonavit_nss,
        max_credit: maxCredit,
        bank_preapproved: data.bank_preapproved,
        bank_name: data.bank_name,
        calculated_at: new Date().toISOString(),
      } satisfies Json,
    })
    .eq("id", user.id);

  if (error) return fail(error.message);

  revalidatePath("/preapproval");

  // Smart matching: active listings the buyer can afford (price <= budget).
  const budget = maxCredit / (1 - DOWN_PAYMENT_PCT);
  const listings = await searchListings({ limit: 24, sortBy: "newest" });

  const matches = listings
    .filter((l) => l.price <= budget)
    .map((l): PreapprovalResult["matches"][number] => {
      const loan = l.price * (1 - DOWN_PAYMENT_PCT);
      const mp =
        monthlyRate === 0 || n === 0
          ? 0
          : (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
      return {
        id: l.id,
        slug: l.slug,
        title: l.title,
        city: l.city,
        colonia: l.colonia,
        price: l.price,
        currency: l.currency,
        image: l.images?.[0] ?? null,
        monthly_payment: Math.round(mp),
      };
    })
    .sort((a, b) => a.monthly_payment - b.monthly_payment);

  return ok({
    infonavit_nss: data.infonavit_nss,
    max_credit: maxCredit,
    bank_preapproved: data.bank_preapproved,
    bank_name: data.bank_name,
    monthly_payment_estimate: Math.round(monthlyPaymentEstimate),
    matches,
  });
}

/**
 * Load the caller's saved preapproval for display on the preapproval page.
 */
export async function getMyPreapproval(): Promise<{
  infonavit_nss: string | null;
  max_credit: number;
  bank_preapproved: boolean;
  bank_name: string | null;
  calculated_at: string | null;
}> {
  const user = await requireUserOrThrow();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("profiles")
    .select("preapproval_data")
    .eq("id", user.id)
    .returns<Array<{ preapproval_data: Json }>>()
    .limit(1);

  const raw = data?.[0]?.preapproval_data;
  if (!raw || typeof raw !== "object") {
    return {
      infonavit_nss: null,
      max_credit: 0,
      bank_preapproved: false,
      bank_name: null,
      calculated_at: null,
    };
  }

  const obj = raw as Record<string, unknown>;
  return {
    infonavit_nss: typeof obj.infonavit_nss === "string" ? obj.infonavit_nss : null,
    max_credit: typeof obj.max_credit === "number" ? obj.max_credit : 0,
    bank_preapproved:
      typeof obj.bank_preapproved === "boolean" ? obj.bank_preapproved : false,
    bank_name: typeof obj.bank_name === "string" ? obj.bank_name : null,
    calculated_at:
      typeof obj.calculated_at === "string" ? obj.calculated_at : null,
  };
}
