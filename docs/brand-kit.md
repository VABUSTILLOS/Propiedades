# Brand kit — Propiedades

> Marketplace inmobiliario de México. **No listamos todo. Solo lo que vale la pena.**

Este documento es la fuente de verdad de la identidad de marca de **Propiedades**.
Complementa la página visual en `/brand` y los activos en `/public/brand/`.

---

## 1. Estrategia

### Posicionamiento

Propiedades es un **marketplace inmobiliario de México** que publica únicamente
propiedades que superan el benchmark de su colonia. No es un directorio: es un
**registro curado de oportunidades**, donde cada listado demuestra su valor con
datos a la vista.

### Promesa

> Analizamos cada propiedad contra el benchmark de su colonia y publicamos
> únicamente las que superan al mercado — con el descuento, los costos de
> cierre y la renta potencial a la vista.

### Audiencias

| Audiencia | Necesidad | Cómo le hablamos |
|---|---|---|
| Compradores e inversionistas | Detectar valor real, no perder tiempo | Datos, descuento, renta potencial, ahorro vs colonia |
| Agentes y propietarios en venta directa | Publicar lo que sí vale la pena | Criterio claro de selección, proceso transparente |

### Personalidad

Curadora, transparente, cálida y mexicana. La marca sabe que menos es más:
prefiere 100 oportunidades reales a 10,000 listados muertos.

### Valores

- **Transparencia** — los datos se muestran, no se esconden.
- **Criterio** — publicar es un acto de selección, no de volumen.
- **Cercanía** — tuteo, calidez y registros locales.
- **Eficiencia** — tu tiempo vale dinero.

### Arquetipo

**El curador / mentor honesto.** Como un asesor inmobiliario de confianza que
revisa cada propiedad antes de recomendarla, con la evidencia en la mano.

---

## 2. Voz y tono

### Principios

1. **Directa y sin relleno** — frases cortas, verbos concretos.
2. **Transparente como la data** — el copy nunca esconde información.
3. **Cálida, cercana, mexicana** — tuteo y registros locales, sin jerga anglo.
4. **Editorial y con criterio** — voz de curador, no de directorio.

### Ejemplos

| Tono | ✗ Antes | ✓ Después |
|---|---|---|
| Propuesta de valor | "Somos la plataforma #1 de bienes raíces con la mayor cantidad de listados." | **No listamos todo. Solo lo que vale la pena.** |
| Confianza / datos | "Excelente oportunidad, precio inmejorable, ¡no lo dejes pasar!" | "Está 8 % debajo del benchmark de la colonia. Costos de cierre a la vista." |
| Vacío de resultados | "No se encontraron resultados. Intente con otros filtros." | "No hay nada que valga la pena con ese filtro. ¿Relajamos la búsqueda?" |

### Reglas de copy

- Tuteo en toda la interfaz ("tu", "tienes").
- Los números se escriben con cifras y formato `es-MX` (miles con coma, precios con `$` y `MXN`).
- El hype ("¡oportunidad única!") y la jerga anglosajona ("best deal", "portfolio") están prohibidos.
- Un titular destaca **una** palabra clave con Instrument Serif itálica.

---

## 3. Logotipo

### Descripción

- **Símbolo**: la vivienda (trazo lucide) sobre un **tile de gradiente cobre**
  (`from-copper to-copper-deep`, radio `14/64`).
- **Wordmark**: "Propiedades" en Plus Jakarta Sans bold, `tracking -0.02em`, tinta ink.
- **Lockup**: símbolo a la izquierda + wordmark a la derecha.

### Versiones oficiales (`/public/brand/`)

| Archivo | Uso |
|---|---|
| `logo.svg` | Lockup completo — header, documentos, social |
| `logo-mark.svg` | Símbolo en color — favicon, avatares, OG image |
| `logo-mark--ink.svg` | Monocromo ink — fondos claros, impresión 1 tinta |
| `logo-mark--cream.svg` | Monocromo cream — bandas ink y fondos oscuros |
| `logo-wordmark.svg` | Solo texto — espacios reducidos |

### Área de resguardo

Margen libre equivalente a la **altura del símbolo** en los cuatro lados.

### Usos incorrectos

- Rotar, estirar o distorsionar el símbolo.
- Cambiar los colores del gradiente o del wordmark.
- Usar el símbolo color sobre fondos de cobre (bajo contraste).
- Recrear el logotipo con texto plano o iconografía distinta.

---

## 4. Color

La fuente de verdad son las variables CSS en `src/app/globals.css`. La paleta se
basa en **copper sobre cream**, con tinta café-rojiza y semánticos sobrios.

### Escala copper (color de marca)

| Nombre | Hex | Token | Uso |
|---|---|---|---|
| Copper soft | `#FFB36B` | `--color-copper-soft` | Acentos sobre fondos claros, ilustración |
| Copper bright | `#E89252` | `--color-copper-bright` | Primary en dark mode, hovers |
| Copper | `#D67E3C` | `--color-copper` | Ring, gradientes, detalle decorativo |
| Copper deep | `#A83810` | `--color-copper-deep` | Extremo del gradiente de marca |
| Copper ink | `#8F2E0F` | `--color-copper-ink` | Texto decorativo sobre cobre profundo |
| Copper dark | `#6E1D00` | `--color-copper-dark` | Extremo oscuro de la escala |

### Neutros cream / ink

| Nombre | Hex | Token | Uso |
|---|---|---|---|
| Background (cream) | `#FBF6F0` | `--background` | Fondo base claro |
| Foreground (ink) | `#24160D` | `--foreground` | Texto principal y wordmark |
| Card | `#FFFFFF` | `--card` | Superficies de tarjetas |
| Muted | `#F7EDE2` | `--muted` | Superficies atenuadas |
| Muted foreground | `#6B5446` | `--muted-foreground` | Texto secundario |
| Border | `#ECD9C6` | `--border` | Divisores y bordes |
| Ink editorial | `#180F08` | `--color-ink` | Bandas hero, ticker, footer (constante entre temas) |

### Semánticos y canales

| Nombre | Hex | Token | Uso |
|---|---|---|---|
| Primary | `#B0491A` | `--primary` | Botones y enlaces activos — **AA 5.1:1** sobre cream |
| Primary foreground | `#FFF7F0` | `--primary-foreground` | Texto sobre primary — **AA 5.2:1** |
| Live | `#7BC796` | `--color-live` | Indicador "registro activo" |
| WhatsApp | `#0A6035` | `--color-whatsapp` | Canal WhatsApp (oscurecido para AA) |
| Destructive | `#C8503E` | `--destructive` | Errores y acciones destructivas — 4.18:1 sobre blanco (por debajo de AA para texto; úsalo solo en superficies color y en tamaños grandes) |
| Ring | `#D67E3C` | `--ring` | Foco de accesibilidad |

### Proporciones

- **~60 %** neutros (cream + ink) — la base.
- **~30 %** copper — lo que debe sentirse vivo y llamar la atención.
- **~10 %** semánticos — acciones, estados y canales.

### Contraste

- `--primary` (`#B0491A`) sobre `--background` (`#FBF6F0`): **5.1:1** — AA.
- `--primary-foreground` (`#FFF7F0`) sobre `--primary`: **5.2:1** — AA.
- El cobre decorativo (`#D67E3C`/`#A83810`) **no** se usa como texto de bajo
  contraste: para texto, ir a `copper-deep`/`primary` o ink.

---

## 5. Tipografía

Tres fuentes con roles claros (definidas en `src/app/layout.tsx`):

| Fuente | Rol | Detalles |
|---|---|---|
| **Plus Jakarta Sans** (`--font-sans`, `--font-heading`) | UI, encabezados, wordmark | Weights 300–800; titulares bold `tracking-tight` |
| **Instrument Serif** (`--font-display`) | Display · énfasis editorial | Itálica para **una** palabra clave por titular |
| **Geist Mono** (`--font-mono`) | Folios, etiquetas, código | Eyebrows `uppercase tracking-[0.22em]`, valores técnicos |

### Reglas

- Titulares: Plus Jakarta Sans **bold** `tracking-tight` (hero `lg:text-6xl`).
- Énfasis: Instrument Serif **italic** para la frase clave — corta, máx. 3 palabras (p. ej., «vale la pena»).
- Eyebrows: mono `text-xs uppercase tracking-[0.22em]` con marcador cobre.
- Nunca mezclar más de una fuente en la misma línea.

---

## 6. Iconografía y forma

- **Iconos**: librería **lucide-react**, trazo `size-4`/`size-5`, stroke 2.
- **Radio**: `--radius: 0.875rem` base; tarjetas `rounded-xl`; el tile del logo `rx=14`.
- **Gradiente de marca**: `from-copper to-copper-deep` — solo en lo que debe sentirse vivo.
- **Bandas editoriales**: ink constante entre temas (`--color-ink`), con textura
  de puntos y texto cream.

---

## 7. Fotografía / imagery

- Fotografía inmobiliaria real y luminosa: fachadas, interiores amplios.
- Se muestra **data sobre la foto**: precio, descuento vs colonia, renta potencial.
- Sin ilustraciones genéricas de stock como elemento central; el símbolo de marca
  reemplaza la iconografía decorativa.

---

## 8. Aplicaciones

### Interfaz (UI)

- Fondo cream, tarjetas blancas, tinta café para texto.
- El cobre marca el camino: CTAs y foco (`ring`); el verde Live indica actividad.
- Los precios siempre visibles y formateados en `es-MX`.

### WhatsApp

- Marca `#0A6035` para el canal; CTAs de continuidad de búsqueda.
- El copy sigue la voz: directo, sin spam, con datos.

### PDF / flyers (`investment-pdf.ts`)

- Header ink con lockup cream, titulares Jakarta bold + serif italic.
- Cobre para acentos y datos clave; tabla de números legible en mono.

### Social

- Imagen OG 1200×630 (`src/app/opengraph-image.tsx`): fondo cream, marca cobre,
  titular "Solo lo que vale la pena", footer con barra cobre.
- Las variantes de logotipo en `/public/brand/` son URL-dirigibles.

---

## 9. Checklist de uso

**Sí** ✅

- [ ] Usar cream como fondo y cobre para lo que llama la atención.
- [ ] Respetar el área de resguardo del logotipo.
- [ ] Verificar contraste AA antes de usar primary sobre fondos de color.
- [ ] Usar Instrument Serif en una sola palabra clave por titular.
- [ ] Ser transparente: los datos siempre se muestran.

**No** ❌

- [ ] Rotar, estirar o recolorar el logotipo fuera de las variantes oficiales.
- [ ] Usar el cobre como texto sobre fondos de cobre.
- [ ] Mezclar más de una fuente por línea o usar serif en párrafos.
- [ ] Escribir con hype o jerga anglosajona.
- [ ] Anunciar un registro que no cumple el criterio de "vale la pena".

---

## 10. Referencias en código

| Activo | Ruta |
|---|---|
| Tokens de color y radio | `src/app/globals.css` |
| Fuentes | `src/app/layout.tsx` + `src/app/assets/fonts/` |
| Página del brand kit | `src/app/brand/page.tsx` |
| Datos del brand kit | `src/modules/brand/data.ts` |
| Imagen social | `src/modules/brand/social-image.tsx` |
| Activos SVG | `public/brand/` |
| Favicon | `src/app/icon.svg` |
