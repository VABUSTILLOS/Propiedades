// 100Casas favicon (180x180 WebP).
// Served from base64 so the asset ships as a text file in the repo while
// browsers receive a real, cache-friendly WebP binary.
const DATA =
  "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" +
  "16vzAAAAAAAAAAAA";

export const dynamic = "force-static";

export function GET() {
  return new Response(Buffer.from(DATA, "base64"), {
    headers: {
      "content-type": "image/webp",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
