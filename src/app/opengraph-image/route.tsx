import { ImageResponse } from "next/og";

import BrandSocialImage from "@/modules/brand/social-image";

export const runtime = "nodejs";
// The image fetches live listing photos + a static map at request time, so it
// must render per request.
export const dynamic = "force-dynamic";

/**
 * Serves the 100Casas.mx social share image at `/opengraph-image`.
 *
 * The old file-convention `opengraph-image.tsx` produced a stable URL hashed
 * from the route file's (re-export) source, so platforms like WhatsApp,
 * Facebook and X kept serving stale image content. This route is addressed
 * with an explicit `?v=` query from root `layout.tsx` metadata — bump
 * `SOCIAL_IMAGE_VERSION` there whenever the image content changes and every
 * crawler will re-scrape a brand-new URL. The query string is ignored here;
 * the latest image is always rendered.
 */
export async function GET() {
  const image = await BrandSocialImage();

  const headers = new Headers(image.headers);
  // Versioned URLs are treated as immutable: crawlers fetch once per ?v= and
  // never need to revalidate until the version is bumped.
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(image.body, {
    status: image.status,
    headers,
  });
}
