import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { ReviewsRow } from "@/modules/lib/database.types";

/**
 * Public reviews for a user — revealed after both parties submit
 * (double-blind engine). Visible on the profile page.
 */
export async function getReviewsForUser(
  subjectId: string,
): Promise<ReviewsRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("reviews")
    .select("*")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false })
    .returns<ReviewsRow[]>();

  return rows ?? [];
}

/**
 * Reviews authored by a user (their pending + submitted reviews).
 */
export async function getReviewsByAuthor(
  authorId: string,
): Promise<ReviewsRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("reviews")
    .select("*")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .returns<ReviewsRow[]>();

  return rows ?? [];
}
