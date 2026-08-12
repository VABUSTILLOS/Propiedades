try { process.loadEnvFile(".env.local"); } catch {}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API = `${url}/rest/v1/properties`;
const H = {apikey:key, Authorization:`Bearer ${key}`, Prefer:"count=exact"};
async function count(qs){const r=await fetch(`${API}?select=id&${qs.join("&")}`,{headers:H});const c=r.headers.get("content-range");return c?parseInt(c.split("/")[1]??"0",10):(await r.json()).length;}
console.log("active total:", await count(["status=eq.active","type=eq.sale"]));
console.log("recamaras>=5:", await count(["status=eq.active","type=eq.sale","recamaras=gte.5"]));
console.log("alberca only:", await count(["status=eq.active","type=eq.sale","or=(title.ilike.*alberca*,title.ilike.*albercas*)"]));
console.log("Chihuahua 50k:", await count(["status=eq.active","type=eq.sale","city=eq.Chihuahua","price=lte.50000"]));
console.log("minBedrooms5 + alberca:", await count(["status=eq.active","type=eq.sale","recamaras=gte.5","or=(title.ilike.*alberca*,title.ilike.*albercas*)"]));
