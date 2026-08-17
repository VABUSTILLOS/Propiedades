const MAX_LONG_EDGE = 1920;
const WEBP_QUALITY = 0.82;

/**
 * Compress an image in the browser before uploading: scales it down to a
 * max of 1920px on the longest edge and re-encodes it as WebP (quality 0.82).
 * Typical result: a 5-10 MB photo becomes ~150-500 KB.
 *
 * Guarantees:
 * - GIFs are returned untouched (re-encoding would drop the animation).
 * - If the WebP output would be larger than the original, the original is kept.
 * - If anything fails (unsupported format, decode error), the original is kept.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
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
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "imagen";
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}
