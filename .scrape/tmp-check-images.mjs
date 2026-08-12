import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf8");
const get = (k) => { const m = env.match(new RegExp(`^${k}=(.+)$`, "m")); return m ? m[1].trim() : null; };
const supabase = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));
const { data, error } = await supabase.from("properties").select("source_url, images").limit(5);
if (error) { console.error(error); process.exit(1); }
for (const r of data) console.log(JSON.stringify({ url: r.source_url, images: r.images?.slice(0,2) }));
