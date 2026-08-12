import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const tables = ["flyer_analytics", "buyer_favorites", "availability_slots", "whatsapp_messages"];
for (const t of tables) {
  const { data, error, count } = await supabase.from(t).select("*", { count: "exact" }).limit(20);
  if (error) { console.log(t, "ERR:", error.message); continue; }
  console.log(`=== ${t} (count=${count}) ===`);
  for (const r of data) console.log(" ", JSON.stringify(r).slice(0, 250));
}
