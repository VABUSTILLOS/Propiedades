/**
 * Slug helpers for property URLs.
 * Kept server-safe: no DOM or browser APIs.
 */

const TRANSLITERATION: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ü: "u",
  ñ: "n",
  Á: "a",
  É: "e",
  Í: "i",
  Ó: "o",
  Ú: "u",
  Ü: "u",
  Ñ: "n",
};

export function slugify(input: string, maxLength?: number): string {
  const slug = input
    .split("")
    .map((char) => TRANSLITERATION[char] ?? char)
    .join("")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return maxLength ? slug.slice(0, maxLength) : slug;
}

/**
 * Build a unique slug for a property listing. Appends a short random
 * suffix when the base slug collides with an existing row.
 */
export async function buildUniqueSlug(
  title: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(title) || "propiedad";
  let candidate = base;
  let attempts = 0;

  while (await exists(candidate)) {
    attempts += 1;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (attempts > 10) {
      candidate = `${base}-${Date.now().toString(36)}`;
      break;
    }
  }

  return candidate;
}
