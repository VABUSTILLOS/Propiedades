import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);
const { data, error } = await supabase
  .from("properties")
  .select("id, title, slug, owner_id, status, type, created_at")
  .order("created_at", { ascending: false });
if (error) { console.error("ERR", error.message); process.exit(1); }
console.log("TOTAL:", data.length);
for (const p of data) console.log(JSON.stringify(p));
