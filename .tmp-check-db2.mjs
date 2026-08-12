import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);
const tables = ["digital_flyers", "market_benchmarks", "reviews", "transactions", "favorites", "favorite_lists", "conversations", "messages", "bids", "co_shopping_groups", "fsbo_listings"];
for (const t of tables) {
  const { data, error, count } = await supabase.from(t).select("*", { count: "exact" }).limit(50);
  if (error) { console.log(t, "ERR:", error.message); continue; }
  console.log(`=== ${t} (count=${count}) ===`);
  for (const r of data) console.log(" ", JSON.stringify(r).slice(0, 300));
}
