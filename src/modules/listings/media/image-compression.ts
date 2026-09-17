const MAX_LONG_EDGE = 1920;
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.85;

/** Formats the app stores and serves back to browsers. */
export const ACCEPTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/**
 * Formats accepted from the device but never stored as-is: HEIC/HEIF (the
 * default format of iPhone and recent macOS camera photos) can't be displayed
 * by most browsers, so they are converted to WebP/JPEG before uploading.
 */
const CONVERTIBLE_IMAGE_MIME_TYPES = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
];

/** Value for the `accept` attribute of a file input. */
export const ACCEPTED_IMAGE_INPUT = [
  ...ACCEPTED_IMAGE_MIME_TYPES,
  ...CONVERTIBLE_IMAGE_MIME_TYPES,
  ".heic",
  ".heif",
].join(",");

/** True for iPhone/macOS HEIC photos, which must never be uploaded raw. */
export function isHeicLikeFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (CONVERTIBLE_IMAGE_MIME_TYPES.includes(type)) return true;
  // Browsers often report an empty type for HEIC files dragged from Finder/Photos.
  return (
    (!type || type === "application/octet-stream") && /\.(heic|heif)$/i.test(file.name)
  );
}

/** Re-encode a canvas, returning null when the browser lacks that encoder. */
async function encodeCanvas(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, quality),
  );
  // Browsers without the requested encoder silently fall back to PNG.
  if (!blob || blob.type !== mime) return null;
  return blob;
}

/**
 * Compress an image in the browser before uploading: scales it down to a
 * max of 1920px on the longest edge and re-encodes it as WebP (quality 0.82),
 * falling back to JPEG when WebP encoding is unavailable.
 * Typical result: a 5-10 MB photo becomes ~150-500 KB.
 *
 * Guarantees:
 * - GIFs are returned untouched (re-encoding would drop the animation).
 * - HEIC/HEIF photos are always converted, so iPhone photos upload fine.
 * - If the re-encoded output would be larger than the original, the original is
 *   kept, except for HEIC/HEIF, which browsers can't display.
 * - If anything fails (unsupported format, decode error), the original is kept
 *   so the caller can report the problem to the user.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (file.type === "image/gif") return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  try {
    const scale = Math.min(
      1,
      MAX_LONG_EDGE / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const encoded = (
      await Promise.all([
        encodeCanvas(canvas, "image/webp", WEBP_QUALITY),
        encodeCanvas(canvas, "image/jpeg", JPEG_QUALITY),
      ])
    ).filter((blob): blob is Blob => blob !== null);
    if (encoded.length === 0) return file;

    const best = encoded.reduce((a, b) => (b.size < a.size ? b : a));
    if (!isHeicLikeFile(file) && best.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "imagen";
    const ext = best.type === "image/jpeg" ? "jpg" : "webp";
    return new File([best], `${baseName}.${ext}`, { type: best.type });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
