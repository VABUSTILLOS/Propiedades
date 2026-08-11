"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserOrThrow } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { fail, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";

const voteSchema = z.object({
  favoriteId: z.string().uuid(),
  vote: z.enum(["like", "dislike"]),
});

const chatSchema = z.object({
  favoriteId: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
});

export type ChatMessage = {
  id: string;
  favorite_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name: string;
};

/**
 * Record a like/dislike vote on a shared favorite. `co_buyer_votes` is a
 * JSONB blob owned by the favorite owner; participants vote via the
 * `is_favorite_participant` RLS helper.
 */
export async function voteFavorite(
  input: Record<string, unknown>,
): Promise<ActionResult<{ likes: number; dislikes: number }>> {
  const user = await requireUserOrThrow();
  const parsed = parseInput(voteSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: favorites } = await supabase
    .from("buyer_favorites")
    .select("id, co_buyer_votes")
    .eq("id", parsed.data.favoriteId)
    .returns<Array<{ id: string; co_buyer_votes: unknown }>>()
    .limit(1);

  const favorite = favorites?.[0];
  if (!favorite) {
    return fail("Favorite not found");
  }

  const raw = (favorite.co_buyer_votes ?? {}) as Record<string, unknown>;
  const voters =
    Array.isArray(raw.voters) && raw.voters.every((v) => typeof v === "string")
      ? (raw.voters as string[])
      : [];
  const myVote = raw[`${user.id}_vote`];

  let votes: Record<string, unknown>;
  if (myVote === parsed.data.vote) {
    votes = { ...raw, [`${user.id}_vote`]: null };
  } else {
    votes = { ...raw, [`${user.id}_vote`]: parsed.data.vote };
  }

  const votersSet = new Set(voters);
  votersSet.add(user.id);
  votes.voters = Array.from(votersSet);
  if (parsed.data.vote === "like") votes[`${user.id}_liked`] = true;
  else votes[`${user.id}_liked`] = false;

  const { error } = await supabase
    .from("buyer_favorites")
    .update({ co_buyer_votes: votes as never })
    .eq("id", parsed.data.favoriteId);
  if (error) {
    return fail(error.message);
  }

  const entries = Object.entries(votes).filter(
    ([k, v]) => k.endsWith("_vote") && (v === "like" || v === "dislike"),
  );
  const likes = entries.filter(([, v]) => v === "like").length;
  const dislikes = entries.filter(([, v]) => v === "dislike").length;

  revalidatePath("/favorites");
  return ok({ likes, dislikes });
}

/**
 * Post a private co-shopping chat message on a shared favorite.
 */
export async function postChatMessage(
  input: Record<string, unknown>,
): Promise<ActionResult<{ message: ChatMessage }>> {
  const user = await requireUserOrThrow();
  const parsed = parseInput(chatSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("co_shopping_chat")
    .insert({
      favorite_id: parsed.data.favoriteId,
      sender_id: user.id,
      content: parsed.data.content,
    })
    .select("*, sender:profiles(full_name)")
    .returns<
      Array<{
        id: string;
        favorite_id: string;
        sender_id: string;
        content: string;
        created_at: string;
        sender: { full_name: string } | null;
      }>
    >()
    .single();

  if (error || !data) {
    return fail(error?.message ?? "Failed to send message");
  }

  const message: ChatMessage = {
    id: data.id,
    favorite_id: data.favorite_id,
    sender_id: data.sender_id,
    content: data.content,
    created_at: data.created_at,
    sender_name: data.sender?.full_name ?? "Co-buyer",
  };

  revalidatePath("/favorites");
  return ok({ message });
}
