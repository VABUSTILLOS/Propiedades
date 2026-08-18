/**
 * Brand kit data for Propiedades.
 * All hex values mirror the tokens in `src/app/globals.css` so the page
 * always shows the source of truth.
 */

export type BrandColor = {
  name: string;
  hex: string;
  token: string;
  usage: string;
  /** Extra note, e.g. contrast ratio or theme context. */
  note?: string;
};

export type BrandColorGroup = {
  id: string;
  title: string;
  description: string;
  colors: BrandColor[];
};

export const brandColorGroups: BrandColorGroup[] = [
  {
    id: "copper",
    title: "Escala copper",
    description:
      "El color de la marca. Gradiente cálido que va del cobre brillante al teja profundo: energía, confianza y calidez mexicana.",
    colors: [
      { name: "Copper soft", hex: "#FFB36B", token: "--color-copper-soft", usage: "Acentos sobre fondos claros e ilustración." },
      { name: "Copper bright", hex: "#E89252", token: "--color-copper-bright", usage: "Primary en dark mode, hover de enlaces en fondos ink." },
      { name: "Copper", hex: "#D67E3C", token: "--color-copper", usage: "Ring de foco, gradientes y detalle decorativo." },
      { name: "Copper deep", hex: "#A83810", token: "--color-copper-deep", usage: "Extremo profundo del gradiente de marca." },
      { name: "Copper ink", hex: "#8F2E0F", token: "--color-copper-ink", usage: "Texto decorativo sobre cobre profundo." },
      { name: "Copper dark", hex: "#6E1D00", token: "--color-copper-dark", usage: "Extremo oscuro de la escala, fondos editoriales." },
    ],
  },
  {
    id: "neutros",
    title: "Neutros cream / ink",
    description:
      "Fondo crema cálido con tinta café-rojiza. Soporte editorial que deja respirar al cobre.",
    colors: [
      { name: "Background (cream)", hex: "#FBF6F0", token: "--background", usage: "Fondo base de la app (claro)." },
      { name: "Foreground (ink)", hex: "#24160D", token: "--foreground", usage: "Texto principal y wordmark." },
      { name: "Card", hex: "#FFFFFF", token: "--card", usage: "Superficies de tarjetas y modales." },
      { name: "Muted", hex: "#F7EDE2", token: "--muted", usage: "Superficies atenuadas, chips de icono." },
      { name: "Muted foreground", hex: "#6B5446", token: "--muted-foreground", usage: "Texto secundario y descripciones." },
      { name: "Border", hex: "#ECD9C6", token: "--border", usage: "Divisores y bordes de inputs." },
      { name: "Ink (editorial)", hex: "#180F08", token: "--color-ink", usage: "Bandas editoriales: hero, ticker, footer." },
      { name: "Ink foreground", hex: "#FBF6F0", token: "--color-ink-foreground", usage: "Texto sobre bandas editoriales." },
    ],
  },
  {
    id: "semanticos",
    title: "Semánticos y canales",
    description:
      "Colores con función específica: acciones, estados y canales. Se usan con moderación y nunca compiten con el cobre.",
    colors: [
      { name: "Primary", hex: "#B0491A", token: "--primary", usage: "Botones y enlaces activos.", note: "WCAG AA 5.1:1 sobre cream." },
      { name: "Primary foreground", hex: "#FFF7F0", token: "--primary-foreground", usage: "Texto sobre primary." , note: "WCAG AA 5.2:1." },
      { name: "Live", hex: "#7BC796", token: "--color-live", usage: "Indicador «registro activo» (siempre constante en ambos temas)." },
      { name: "WhatsApp", hex: "#0A6035", token: "--color-whatsapp", usage: "Canal WhatsApp y CTAs de continuidad de búsqueda.", note: "Oscurecido para AA." },
      { name: "Destructive", hex: "#C8503E", token: "--destructive", usage: "Errores y acciones destructivas." },
      { name: "Ring", hex: "#D67E3C", token: "--ring", usage: "Foco visible de accesibilidad." },
    ],
  },
];

export type BrandType = {
  name: string;
  role: string;
  details: string;
  weights: string;
  sample: string;
  sampleClass: string;
  css: string;
};

export const brandTypes: BrandType[] = [
  {
    name: "Plus Jakarta Sans",
    role: "UI, encabezados y wordmark",
    details:
      "Sans humanista moderna con gran legibilidad. Es la voz principal: titulares bold tracking-tight y texto de interfaz.",
    weights: "300–800",
    sample: "Solo lo que vale la pena",
    sampleClass: "font-sans font-bold tracking-tight",
    css: "--font-sans · --font-heading",
  },
  {
    name: "Instrument Serif",
    role: "Display · énfasis editorial",
    details:
      "Serif itálica para destacar una palabra clave por página dentro del titular («vale la pena»). Aporta calidez y carácter editorial.",
    weights: "400 (+ italic)",
    sample: "vale la pena",
    sampleClass: "font-display italic",
    css: "--font-display",
  },
  {
    name: "Geist Mono",
    role: "Folios, etiquetas y código",
    details:
      "Monoespaciada para eyebrows en mayúsculas con tracking amplio («Registro activo», folios de propiedad) y valores técnicos.",
    weights: "400–700",
    sample: "Registro activo — 12 nuevas esta semana",
    sampleClass: "font-mono text-xs uppercase tracking-[0.22em]",
    css: "--font-mono",
  },
];

export type VoiceRule = {
  title: string;
  description: string;
};

export const voiceRules: VoiceRule[] = [
  {
    title: "Directa y sin relleno",
    description:
      "Frases cortas, verbos concretos. «No listamos todo» antes que «Ofrecemos una amplia variedad».",
  },
  {
    title: "Transparente como la data",
    description:
      "Se muestran descuentos, costos de cierre y renta potencial. El copy nunca esconde la información.",
  },
  {
    title: "Cálida, cercana, mexicana",
    description:
      "Tuteo, registros locales y entusiasmo contenido. Sin jerga anglosajona ni hype.",
  },
  {
    title: "Editorial y con criterio",
    description:
      "La marca dicta qué se publica («solo lo que vale la pena»): voz de curador, no de directorio.",
  },
];

export type VoiceExample = {
  tone: string;
  bad: string;
  good: string;
};

export const voiceExamples: VoiceExample[] = [
  {
    tone: "Propuesta de valor",
    bad: "Somos la plataforma #1 de bienes raíces con la mayor cantidad de listados.",
    good: "No listamos todo. Solo lo que vale la pena.",
  },
  {
    tone: "Confianza / datos",
    bad: "Excelente oportunidad, precio inmejorable, ¡no lo dejes pasar!",
    good: "Está 8 % debajo del benchmark de la colonia. Costos de cierre a la vista.",
  },
  {
    tone: "Vacío de resultados",
    bad: "No se encontraron resultados. Intente con otros filtros.",
    good: "No hay nada que valga la pena con ese filtro. ¿Relajamos la búsqueda?",
  },
];

export const brandTokens = [
  { token: "--radius", value: "0.875rem", usage: "Radio base de tarjetas, inputs y componentes (tokens sm–4xl lo escalan)." },
  { token: "--color-copper", value: "#D67E3C", usage: "Gradiente de marca: `from-copper to-copper-deep`." },
  { token: "--color-copper-deep", value: "#A83810", usage: "Extremo del tile del logotipo y CTAs." },
  { token: "--color-ink", value: "#180F08", usage: "Bandas editoriales constantes entre temas." },
  { token: "--color-live", value: "#7BC796", usage: "Indicador «registro activo»." },
  { token: "--color-whatsapp", value: "#0A6035", usage: "Canal WhatsApp." },
  { token: "--animate-ticker", value: "ticker-scroll 90s", usage: "Teleprinter del hero (actividad en vivo)." },
  { token: "--font-display", value: "Instrument Serif", usage: "Énfasis itálico en titulares." },
];

export const logoAssets = [
  {
    src: "/brand/logo.svg",
    name: "Logotipo horizontal",
    note: "Marca + wordmark. Uso estándar en header, documentos y social.",
    fileName: "logo.svg",
    className: "h-16 w-auto",
    background: "bg-card",
  },
  {
    src: "/brand/logo-mark.svg",
    name: "Símbolo (color)",
    note: "Tile de gradiente cobre con la vivienda. Favicon y avatares.",
    fileName: "logo-mark.svg",
    className: "size-16",
    background: "bg-card",
  },
  {
    src: "/brand/logo-mark--ink.svg",
    name: "Símbolo monocromo — ink",
    note: "Para fondos claros, impresión a una tinta y estampados.",
    fileName: "logo-mark--ink.svg",
    className: "size-16",
    background: "bg-[#FBF6F0]",
  },
  {
    src: "/brand/logo-mark--cream.svg",
    name: "Símbolo monocromo — cream",
    note: "Para fondos oscuros e ink editorial.",
    fileName: "logo-mark--cream.svg",
    className: "size-16",
    background: "bg-ink",
  },
  {
    src: "/brand/logo-wordmark.svg",
    name: "Wordmark",
    note: "Solo el nombre en Plus Jakarta Sans bold. Espacios reducidos.",
    fileName: "logo-wordmark.svg",
    className: "h-12 w-auto",
    background: "bg-card",
  },
];
