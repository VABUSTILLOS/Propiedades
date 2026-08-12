try { process.loadEnvFile(".env.local"); } catch {}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const API = `${url}/rest/v1/properties`;
const r = await fetch(`${API}?select=id&status=eq.active&type=eq.sale&city=eq.Chihuahua&price=lte.2000000`, {headers:{apikey:key,Authorization:`Bearer ${key}`}});
console.log("status", r.status);
console.log("content-range", r.headers.get("content-range"));
console.log("body", (await r.text()).slice(0,300));
