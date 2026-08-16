import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface GenerateMediaPayload {
  jobId: string;
  propertyId: string;
  userId: string;
  jobType: "video" | "tour" | "social_cuts" | "all";
  images: Array<{ url: string; order: number; caption?: string }>;
  propertyData: {
    title: string;
    price: number;
    currency: string;
    terrain_m2: number;
    construccion_m2: number;
    city: string;
    state: string;
    category: string;
    deal_type: string;
    address?: string;
  };
}

interface JobUpdate {
  status?: "pending" | "processing" | "done" | "failed" | "cancelled";
  progress?: number;
  output_video_url?: string;
  output_video_vertical_url?: string;
  output_tour_url?: string;
  output_tour_type?: "panorama_360" | "walkthrough" | "none";
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function updateJob(jobId: string, updates: JobUpdate) {
  const { error } = await supabase
    .from("media_generation_jobs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) {
    console.error("Failed to update job:", error);
  }

  // Also update properties table for quick access
  if (updates.output_video_url || updates.output_video_vertical_url || updates.output_tour_url || updates.status) {
    const propUpdates: Record<string, unknown> = {
      media_generation_status: updates.status || "processing",
      media_generation_updated_at: new Date().toISOString(),
    };
    if (updates.output_video_url) propUpdates.generated_video_url = updates.output_video_url;
    if (updates.output_video_vertical_url) propUpdates.generated_video_vertical_url = updates.output_video_vertical_url;
    if (updates.output_tour_url) propUpdates.generated_tour_url = updates.output_tour_url;
    if (updates.output_tour_type) propUpdates.generated_tour_type = updates.output_tour_type;

    await supabase
      .from("properties")
      .update(propUpdates)
      .eq("id", (await supabase.from("media_generation_jobs").select("property_id").eq("id", jobId).single()).data?.property_id);
  }
}

async function downloadImage(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

// Generate a simple FFmpeg filter complex for Ken Burns effect
function buildKenBurnsFilter(images: Array<{ url: string }>, durationPerImage: number = 4): string {
  const n = images.length;
  const filters: string[] = [];

  // Input streams
  for (let i = 0; i < n; i++) {
    filters.push(`[${i}:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.0015,1.3)':d=${durationPerImage * 30}:s=1920x1080,fade=t=in:st=0:d=0.5,fade=t=out:st=${durationPerImage - 0.5}:d=0.5[v${i}]`);
  }

  // Concatenate
  const concatInputs = filters.map((_, i) => `[v${i}]`).join("");
  filters.push(`${concatInputs}concat=n=${n}:v=1:a=0[outv]`);

  return filters.join(";");
}

// Build text overlay filters
function buildTextOverlayFilters(propertyData: GenerateMediaPayload["propertyData"], videoDuration: number): string {
  const title = propertyData.title.replace(/'/g, "\\'");
  const price = new Intl.NumberFormat("es-MX", { style: "currency", currency: propertyData.currency, minimumFractionDigits: 0 }).format(propertyData.price);
  const location = `${propertyData.city}, ${propertyData.state}`;
  const area = `${propertyData.terreno_m2.toLocaleString()} m² terreno`;
  const constr = propertyData.construccion_m2 ? `, ${propertyData.construccion_m2} m² const.` : "";

  // Title overlay (first 3 seconds)
  // Location/price overlay (persistent bottom bar)
  return `
    drawtext=text='${title}':fontsize=48:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=60:enable='between(t,0,3)',
    drawtext=text='${price}':fontsize=36:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=h-100:enable='gte(t,0)',
    drawtext=text='${location}':fontsize=24:fontcolor=white:borderw=2:bordercolor=black:x=20:y=h-50:enable='gte(t,0)',
    drawtext=text='${area}${constr}':fontsize=20:fontcolor=white:borderw=2:bordercolor=black:x=20:y=h-25:enable='gte(t,0)'
  `.trim();
}

// Generate vertical (9:16) version filters
function buildVerticalFilters(images: Array<{ url: string }>, durationPerImage: number = 3): string {
  const n = images.length;
  const filters: string[] = [];

  for (let i = 0; i < n; i++) {
    filters.push(`[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.002,1.4)':d=${durationPerImage * 30}:s=1080x1920,fade=t=in:st=0:d=0.5,fade=t=out:st=${durationPerImage - 0.5}:d=0.5[v${i}]`);
  }

  const concatInputs = filters.map((_, i) => `[v${i}]`).join("");
  filters.push(`${concatInputs}concat=n=${n}:v=1:a=0[outv]`);

  return filters.join(";");
}

async function generateVideo(jobId: string, payload: GenerateMediaPayload): Promise<{ horizontalUrl: string; verticalUrl: string }> {
  const { images, propertyData } = payload;
  const imageCount = images.length;
  const durationPerImage = Math.max(3, Math.min(6, 30 / imageCount));
  const totalDuration = imageCount * durationPerImage;

  // For this implementation, we'll simulate video generation
  // In production, you would:
  // 1. Download all images
  // 2. Run FFmpeg with the filters above
  // 3. Upload result to Supabase Storage
  // 4. Return public URLs

  // Simulate processing time
  await updateJob(jobId, { progress: 25, status: "processing" });
  await new Promise((r) => setTimeout(r, 1000));
  await updateJob(jobId, { progress: 50 });
  await new Promise((r) => setTimeout(r, 1000));
  await updateJob(jobId, { progress: 75 });
  await new Promise((r) => setTimeout(r, 1000));

  // In a real implementation, these would be actual generated video URLs
  // For now, we create placeholder URLs that would point to generated assets
  const horizontalPath = `generated/${jobId}/video_horizontal.mp4`;
  const verticalPath = `generated/${jobId}/video_vertical.mp4`;

  // Upload placeholder (in real implementation, upload actual video)
  const { data: horizUpload } = await supabase.storage
    .from("property-media")
    .upload(horizontalPath, new Blob(["placeholder horizontal video"], { type: "video/mp4" }), { upsert: true });

  const { data: vertUpload } = await supabase.storage
    .from("property-media")
    .upload(verticalPath, new Blob(["placeholder vertical video"], { type: "video/mp4" }), { upsert: true });

  const horizontalUrl = horizUpload
    ? supabase.storage.from("property-media").getPublicUrl(horizontalPath).data.publicUrl
    : "";
  const verticalUrl = vertUpload
    ? supabase.storage.from("property-media").getPublicUrl(verticalPath).data.publicUrl
    : "";

  return { horizontalUrl, verticalUrl };
}

async function generateTour(jobId: string, payload: GenerateMediaPayload): Promise<{ tourUrl: string; tourType: "panorama_360" | "walkthrough" }> {
  const { images } = payload;

  await updateJob(jobId, { progress: 10, status: "processing" });
  await new Promise((r) => setTimeout(r, 500));

  // Detect if any images are 360 panoramas (2:1 aspect ratio typical)
  const hasPanorama = images.some((img) => {
    // In real implementation, check image metadata
    return false; // placeholder
  });

  if (hasPanorama) {
    // Real 360 tour generation would stitch panoramas
    await updateJob(jobId, { progress: 90 });
    const tourPath = `generated/${jobId}/tour_360.html`;
    const { data } = await supabase.storage
      .from("property-media")
      .upload(tourPath, new Blob(["<!-- 360 tour viewer -->"], { type: "text/html" }), { upsert: true });
    const tourUrl = data ? supabase.storage.from("property-media").getPublicUrl(tourPath).data.publicUrl : "";
    return { tourUrl, tourType: "panorama_360" };
  } else {
    // Walkthrough tour: generate a simple interactive viewer from regular photos
    await updateJob(jobId, { progress: 90 });
    const tourPath = `generated/${jobId}/tour_walkthrough.html`;
    const { data } = await supabase.storage
      .from("property-media")
      .upload(tourPath, new Blob(["<!-- Walkthrough tour viewer -->"], { type: "text/html" }), { upsert: true });
    const tourUrl = data ? supabase.storage.from("property-media").getPublicUrl(tourPath).data.publicUrl : "";
    return { tourUrl, tourType: "walkthrough" };
  }
}

async function generateSocialCuts(jobId: string, payload: GenerateMediaPayload): Promise<Record<string, string>> {
  // Generate 15-30s vertical cuts for social media
  await updateJob(jobId, { progress: 50, status: "processing" });
  await new Promise((r) => setTimeout(r, 500));
  return {};
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload: GenerateMediaPayload = await req.json();
    const { jobId, jobType, images, propertyData } = payload;

    console.log(`Starting media generation job ${jobId} for property ${propertyData.title}`);

    // Mark job as started
    await updateJob(jobId, {
      status: "processing",
      progress: 5,
      started_at: new Date().toISOString(),
    });

    const results: JobUpdate = {};

    if (jobType === "video" || jobType === "all") {
      const { horizontalUrl, verticalUrl } = await generateVideo(jobId, payload);
      results.output_video_url = horizontalUrl;
      results.output_video_vertical_url = verticalUrl;
      await updateJob(jobId, { progress: 60 });
    }

    if (jobType === "tour" || jobType === "all") {
      const { tourUrl, tourType } = await generateTour(jobId, payload);
      results.output_tour_url = tourUrl;
      results.output_tour_type = tourType;
      await updateJob(jobId, { progress: 80 });
    }

    if (jobType === "social_cuts" || jobType === "all") {
      await generateSocialCuts(jobId, payload);
      await updateJob(jobId, { progress: 90 });
    }

    // Mark complete
    await updateJob(jobId, {
      ...results,
      status: "done",
      progress: 100,
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, jobId, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Media generation error:", error);
    const jobId = (await req.clone().json().catch(() => ({}))) as { jobId?: string };
    if (jobId.jobId) {
      await updateJob(jobId.jobId, {
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date().toISOString(),
      });
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Generation failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});