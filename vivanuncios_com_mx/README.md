# Vivanuncios scraper

Scrapy project que extrae anuncios de [Vivanuncios](https://www.vivanuncios.com.mx)
para alimentar la base de propiedades del chatbot.

## Flujo completo

```bash
# 1) Recorre las páginas de listados de la ciudad/deal elegido, abre cada
#    anuncio y extrae el detalle completo (precio, ubicación, recámaras, m²,
#    imágenes, contacto). Produce un JSONL (una línea por propiedad).
scrapy crawl vivanuncios -a city=<ciudad> -a deal=<sale|rent> [-a pages=N] \
  -o detail_output.jsonl

# 2) Importa el JSONL a Supabase (idempotente por listing_id_vivanuncios).
node scripts/import-vivanuncios.mjs detail_output.jsonl --city=... --state=...

# 3) Opcional: embeddings semánticos (requiere GEMINI_API_KEY).
node scripts/backfill-embeddings.mjs
```

> El spider `property_detail` es una alternativa para re-procesar un lote de
> URLs ya conocido (lee `property_urls.json` en
> `vivanuncios_com_mx/vivanuncios_com_mx/`, la semilla de los 105 anuncios ya
> en la base, con contacto vía Playwright). Para un crawl nuevo, `vivanuncios`
> ya produce el JSONL completo con `-o`.

## Spider `vivanuncios` (listados + detalle)

Parametrizado por argumentos CLI:

| Argumento | Valores | Default | Descripción |
|-----------|---------|---------|-------------|
| `city` | slug de localidad | `chihuahua` | Zona a recorrer (p. ej. `monterrey`, `guadalajara`, `cdmx`) |
| `deal` | `sale` o `rent` | `sale` | Venta (`venta-`) o renta (`renta-`) |
| `pages` | entero | `1` | Máximo de páginas de resultados a recorrer |

Ejemplos:

```bash
# Ventas en Chihuahua (comportamiento original)
scrapy crawl vivanuncios -o vivanuncios-chihuahua.jsonl

# 5 páginas de rentas en Monterrey
scrapy crawl vivanuncios -a city=monterrey -a deal=rent -a pages=5 -o rentas-mty.jsonl

# Ventas en CDMX, 3 páginas
scrapy crawl vivanuncios -a city=cdmx -a pages=3 -o ventas-cdmx.jsonl
```

El spider lee las cards de listados (`[data-qa^="posting "]` → `data-to-posting`),
encadena la paginación (hasta `pages`) y, por cada anuncio, extrae el detalle
completo (`PropertyItem`: precio, ubicación, recámaras, m², imágenes, contacto).
La salida con `-o <archivo>.jsonl` es directamente importable.

## Spider `property_detail` (re-procesar URLs conocidas)

Alternativa que usa Playwright (scrapy-playwright) para re-procesar un lote de
URLs ya conocido, leyendo `property_urls.json` (o `-a urls_file=...`). Sirve
para re-correr contacto/imágenes sobre los anuncios ya importados. Produce el
mismo `PropertyItem` (JSONL con `listing_id_vivanuncios`).

## Importación a Supabase

`scripts/import-vivanuncios.mjs` convierte el JSONL en filas de `properties`:

```bash
node scripts/import-vivanuncios.mjs .scrape/backfill-output.jsonl \
  --city=Chihuahua --state=Chihuahua
```

- **Idempotente**: omite filas cuyo `listing_id_vivanuncios` o `source_url`
  ya existen en la base.
- **`--dry-run`**: muestra qué insertaría sin tocar la base.
- **`--limit=N`**: procesa solo las primeras N líneas.
- **`--type=sale|rent`**: fuerza el tipo (si no, se infiere de la URL
  `renta-`/`/r-`).
- **`--city`/`--state`**: valores por defecto para anuncios sin ubicación
  parseable (el spider de Chihuahua deja la ciudad vacía en ~23 casos).
- Inserta con `status: "active"`, `owner_id` del agente demo, y registra
  `source_name="vivanuncios"`.

Requiere `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`
de la raíz del repo.

## Notas

- **Rentas**: el catálogo actual no tiene inventario de renta; usa
  `-a deal=rent` para scrapear rentas y poblar `type="rent"`.
- **Geocoding**: el importador no geocodifica (lat/lng quedan NULL). Se puede
  enriquecer después si se necesita mapa.
- **Semántico**: tras importar, ejecuta `node scripts/backfill-embeddings.mjs`
  para que las búsquedas con `query` usen embeddings (requiere `GEMINI_API_KEY`;
  sin ella las búsquedas degradan a ILIKE, que ya funciona).
