import "server-only";

import { env } from "@/modules/lib/env";
import { createSupabaseServiceClient } from "@/modules/lib/supabase/service";
import type { NormalizedInboundMessage } from "@/modules/whatsapp/server";

/**
 * WhatsApp media ingestion for the property intake flow.
 *
 * Meta's Cloud API does NOT include media bytes (nor a public URL) in the
 * webhook payload — only a media id, and the download URL it resolves to
 * expires within ~5 minutes. So images must be fetched inside the webhook
 * lifecycle and copied to Supabase Storage immediately.
 */

const GRAPH_BASE = "https://graph.facebook.com/v23.0";
const BUCKET = "property-images";
const MAX_IMAGES_PER_INTAKE = 10;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function whatsappMediaConfigured(): boolean {
  return Boolean(env.whatsappGraphToken);
}

interface DownloadedMedia {
  data: Buffer;
  contentType: string;
}

/**
 * Resolve a media id to a temporary download URL and fetch the binary.
 * Both Graph API calls need the access token. Returns null on any failure
 * so the intake continues with fewer photos rather than dying.
 */
export async function downloadWhatsAppMedia(
  mediaId: string,
): Promise<DownloadedMedia | null> {
  if (!whatsappMediaConfigured()) return null;

  try {
    const metaRes = await fetch(`${GRAPH_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${env.whatsappGraphToken}` },
    });
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;

    const binRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${env.whatsappGraphToken}` },
    });
    if (!binRes.ok) return null;

    const contentType =
      meta.mime_type ?? binRes.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;

    return { data: Buffer.from(await binRes.arrayBuffer()), contentType };
  } catch {
    return null;
  }
}

/** Upload one image to the public property-images bucket. Returns public URL. */
export async function uploadIntakeImage(
  propertyId: string,
  media: DownloadedMedia,
): Promise<string | null> {
  const supabase = createSupabaseServiceClient();
  const ext = EXT_BY_MIME[media.contentType] ?? "jpg";
  const path = `intake/${propertyId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, media.data, { contentType: media.contentType });
  if (error) return null;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}

/**
 * Download every image in a batch of inbound messages and copy them to
 * Storage under the property's intake folder. Returns the public URLs.
 */
export async function ingestInboundImages(
  propertyId: string,
  messages: NormalizedInboundMessage[],
): Promise<string[]> {
  const imageIds = messages
    .filter((m) => m.messageType === "image" && m.mediaId)
    .map((m) => m.mediaId as string)
    .slice(0, MAX_IMAGES_PER_INTAKE);

  const urls: string[] = [];
  for (const mediaId of imageIds) {
    const media = await downloadWhatsAppMedia(mediaId);
    if (!media) continue;
    const url = await uploadIntakeImage(propertyId, media);
    if (url) urls.push(url);
  }
  return urls;
}
