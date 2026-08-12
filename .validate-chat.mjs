try { process.loadEnvFile(".env.local"); } catch {}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const API = `${url}/rest/v1/properties`;
const H = {apikey:key, Authorization:`Bearer ${key}`, Prefer:"count=exact"};

function fold(ch){switch(ch){case"á":case"Á":return"a";case"é":case"É":return"e";case"í":case"Í":return"i";case"ó":case"Ó":return"o";case"ú":case"Ú":return"u";case"ü":case"Ü":return"u";case"ñ":case"Ñ":return"n";default:return ch;}}
function plural(w){const l=w.toLowerCase(); if(/z$/.test(l))return w.slice(0,-1)+"ces"; if(l.endsWith("s"))return w; return w+"s";}
function variants(q){const s=q.toLowerCase(),p=plural(s);const set=new Set([s,p]);for(const v of [s,p]){const f=v.replace(/[áéíóúüñÁÉÍÓÚÜÑ]/g,fold);if(f!==v)set.add(f);}return [...set];}
function esc(v){return v.replace(/[\\%_]/g,c=>`\\${c}`);}
function orClause(q){const cols=["title","description","colonia","city"];const parts=[];for(const c of cols){for(const v of variants(q)){parts.push(`${c}.ilike.*${esc(v)}*`);if(parts.length>=48)break;}if(parts.length>=48)break;}return parts.join(",");}

async function count(f){
  const qs = ["select=id","status=eq.active","type=eq.sale"];
  if(f.city) qs.push(`city=eq.${encodeURIComponent(f.city)}`);
  if(f.maxPrice!=null) qs.push(`price=lte.${f.maxPrice}`);
  if(f.minPrice!=null) qs.push(`price=gte.${f.minPrice}`);
  if(f.query) qs.push(`or=(${orClause(f.query)})`);
  if(f.isLand||f.category==="terreno") qs.push("category=eq.terreno");
  if(f.minM2!=null){const col=(f.isLand||f.category==="terreno")?"terreno_m2":"construccion_m2"; qs.push(`${col}=gte.${f.minM2}`);}
  if(f.minBedrooms!=null) qs.push(`recamaras=gte.${f.minBedrooms}`);
  const r = await fetch(`${API}?${qs.join("&")}`, {headers:H});
  const c = r.headers.get("content-range");
  return c ? parseInt(c.split("/")[1] ?? "0",10) : (await r.json()).length;
}

const tests = [
  ["casa+Chihuahua+<=2M", {city:"Chihuahua", maxPrice:2000000, query:"casa"}],
  ["alberca<=5M", {maxPrice:5000000, query:"alberca"}],
  ["terreno (category)", {isLand:true}],
  ["terreno minM2 500", {isLand:true, minM2:500}],
  ["departamento query", {query:"departamento"}],
  ["juarez city", {city:"Juárez"}],
  ["recamaras query", {query:"recamaras"}],
];
for (const [name,f] of tests) console.log(name.padEnd(24), "=>", await count(f));
