/**
 * Pure image-array helpers for the admin gallery actions.
 *
 * Kept dependency-free (no server/client imports) so the behavior can be
 * exercised headlessly by `scripts/verify-admin-images.mjs`.
 */

/** Hard cap shared with the wizard (see listings/actions.ts). */
export const ADMIN_MAX_IMAGES = 50;

/**
 * Append `newUrls` to `current`, skipping URLs already present and capping the
 * result at `ADMIN_MAX_IMAGES`. The order of `current` is preserved.
 */
export function addImageUrls(current: string[], newUrls: string[]): string[] {
  const seen = new Set(current);
  const merged = [...current];
  for (const url of newUrls) {
    if (merged.length >= ADMIN_MAX_IMAGES) break;
    if (seen.has(url)) continue;
    seen.add(url);
    merged.push(url);
  }
  return merged;
}

/** Remove every occurrence of `urlToRemove` from the list. */
export function removeImageUrl(current: string[], urlToRemove: string): string[] {
  return current.filter((url) => url !== urlToRemove);
}

/**
 * Set the list to `orderedUrls` in the given order, keeping only URLs that
 * already exist in `current`. Unknown URLs (stale client, removed images,
 * injection attempts) are silently dropped — "lenient keep-existing filter".
 */
export function reorderImageUrls(current: string[], orderedUrls: string[]): string[] {
  const existing = new Set(current);
  return orderedUrls.filter((url) => existing.has(url));
}
