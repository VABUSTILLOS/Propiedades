import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { PropertiesRow } from "@/modules/lib/database.types";

export type AdminPropertyFilter = "all" | "archived" | "deleted";

export type AdminPropertyRow = PropertiesRow & {
  owner_email: string;
  owner_name: string;
  images: string[] | null;
};

/**
 * Properties for the admin moderation panel. Unlike public queries (which
 * only expose status='active'), the admin sees everything except deleted
 * unless explicitly requested. Relies on the "Admins manage all properties"
 * RLS policy (migration 051).
 */
export async function getAdminProperties(
  filter: AdminPropertyFilter,
): Promise<AdminPropertyRow[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("properties")
    .select("*")
    .order("updated_at", { ascending: false });

  if (filter === "archived") {
    query = query.eq("status", "archived");
  } else if (filter === "deleted") {
    query = query.eq("status", "deleted");
  } else {
    query = query.neq("status", "deleted");
  }

  const { data: rows } = await query.returns<PropertiesRow[]>();
  const properties = rows ?? [];
  if (properties.length === 0) return [];

  const ownerIds = [
    ...new Set(
      properties.map((p) => p.owner_id).filter((id): id is string => !!id),
    ),
  ];
  const { data: owners } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", ownerIds)
    .returns<{ id: string; email: string; full_name: string }[]>();

  const ownerById = new Map((owners ?? []).map((o) => [o.id, o]));

  return properties.map((p) => {
    const owner = p.owner_id ? ownerById.get(p.owner_id) : undefined;
    return {
      ...p,
      images: p.images ?? null,
      owner_email: owner?.email ?? "",
      owner_name: owner?.full_name ?? "",
    };
  });
}
