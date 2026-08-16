import { NextResponse } from "next/server";

import { env } from "@/modules/lib/env";
import type { PropertiesRow } from "@/modules/lib/database.types";
import { createSupabaseServiceClient } from "@/modules/lib/supabase/service";

/**
 * Media generation worker (video + tour) for the listing wizard.
 *
 * Replaces the former Supabase Edge Function: same payload, same job table
 * contract, but runs as a Next.js Route Handler so it needs no separate
 * deployment and works identically on Vercel and locally.
 *
 * Protected by a shared secret (service role key) since it performs
 * privileged writes with the service-role client.
 */

export const maxDuration = 60;

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildTourHtml(payload: GenerateMediaPayload): string {
  const { propertyData } = payload;
  const images = [...payload.images].sort((a, b) => a.order - b.order);
  const price = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: propertyData.currency || "MXN",
    minimumFractionDigits: 0,
  }).format(propertyData.price || 0);
  const location = [propertyData.city, propertyData.state].filter(Boolean).join(", ");
  const areas = [
    propertyData.terrain_m2 ? `${propertyData.terrain_m2.toLocaleString("es-MX")} m² terreno` : "",
    propertyData.construccion_m2 ? `${propertyData.construccion_m2.toLocaleString("es-MX")} m² construcción` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const imagesJson = JSON.stringify(images.map((img) => img.url)).replace(/</g, "\\u003c");
  const durationPerImage = Math.max(3, Math.min(6, 30 / Math.max(images.length, 1)));

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(propertyData.title || "Recorrido de la propiedad")}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; background: #000; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; }
  #stage { position: fixed; inset: 0; }
  .slide { position: absolute; inset: 0; opacity: 0; transition: opacity 1s ease; }
  .slide.active { opacity: 1; }
  .slide img { width: 100%; height: 100%; object-fit: cover; animation: kenburns ${durationPerImage + 2}s ease-out forwards; }
  @keyframes kenburns { from { transform: scale(1) translate(0, 0); } to { transform: scale(1.12) translate(-1.5%, -1.5%); } }
  #hud { position: fixed; left: 0; right: 0; bottom: 0; padding: 28px 24px 20px; color: #fff;
         background: linear-gradient(transparent, rgba(0,0,0,.75)); }
  #hud h1 { font-size: clamp(18px, 3vw, 30px); font-weight: 700; text-shadow: 0 1px 4px rgba(0,0,0,.6); }
  #hud .meta { margin-top: 6px; font-size: clamp(13px, 1.8vw, 17px); opacity: .92; }
  #price { position: fixed; top: 20px; left: 24px; color: #fff; font-size: clamp(20px, 3.4vw, 34px);
           font-weight: 800; text-shadow: 0 1px 6px rgba(0,0,0,.7); }
  #counter { position: fixed; top: 24px; right: 24px; color: #fff; font-size: 13px;
             background: rgba(0,0,0,.45); padding: 4px 10px; border-radius: 999px; }
  #progress { position: fixed; top: 0; left: 0; height: 3px; background: #fff; width: 0; transition: width .3s linear; }
  .nav { position: fixed; top: 50%; transform: translateY(-50%); border: 0; cursor: pointer;
         background: rgba(0,0,0,.45); color: #fff; font-size: 26px; line-height: 1;
         padding: 12px 16px; border-radius: 999px; }
  .nav:hover { background: rgba(0,0,0,.7); }
  #prev { left: 16px; } #next { right: 16px; }
  #toggle { position: fixed; bottom: 22px; right: 24px; border: 0; cursor: pointer;
            background: rgba(0,0,0,.45); color: #fff; font-size: 13px; padding: 8px 14px; border-radius: 999px; }
</style>
</head>
<body>
<div id="stage"></div>
<div id="progress"></div>
<div id="price">${escapeHtml(price)}</div>
<div id="counter"></div>
<div id="hud">
  <h1>${escapeHtml(propertyData.title || "Propiedad")}</h1>
  <div class="meta">${escapeHtml([location, areas].filter(Boolean).join(" — "))}</div>
</div>
<button class="nav" id="prev" aria-label="Anterior">&#8249;</button>
<button class="nav" id="next" aria-label="Siguiente">&#8250;</button>
<button id="toggle">Pausar</button>
<script>
  const images = ${imagesJson};
  const DURATION = ${durationPerImage * 1000};
  const stage = document.getElementById("stage");
  const counter = document.getElementById("counter");
  const progress = document.getElementById("progress");
  const toggle = document.getElementById("toggle");
  let index = 0, playing = true, timer = null, startedAt = Date.now();

  images.forEach((url, i) => {
    const slide = document.createElement("div");
    slide.className = "slide";
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Foto " + (i + 1);
    slide.appendChild(img);
    stage.appendChild(slide);
  });
  const slides = Array.from(stage.children);

  function show(i) {
    index = (i + images.length) % images.length;
    slides.forEach((s, j) => {
      s.classList.toggle("active", j === index);
      const img = s.querySelector("img");
      if (j === index) { img.style.animation = "none"; void img.offsetWidth; img.style.animation = ""; }
    });
    counter.textContent = (index + 1) + " / " + images.length;
    startedAt = Date.now();
  }
  function tick() { show(index + 1); }
  function schedule() { clearInterval(timer); if (playing) timer = setInterval(tick, DURATION); }
  document.getElementById("next").onclick = () => { show(index + 1); schedule(); };
  document.getElementById("prev").onclick = () => { show(index - 1); schedule(); };
  toggle.onclick = () => { playing = !playing; toggle.textContent = playing ? "Pausar" : "Reproducir"; schedule(); };
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { show(index + 1); schedule(); }
    if (e.key === "ArrowLeft") { show(index - 1); schedule(); }
  });
  setInterval(() => {
    if (!playing) return;
    progress.style.width = Math.min(100, ((Date.now() - startedAt) / DURATION) * 100) + "%";
  }, 200);
  if (images.length) show(0);
  schedule();
</script>
</body>
</html>`;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.supabaseServiceRoleKey}`;
  if (!env.supabaseServiceRoleKey || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: GenerateMediaPayload;
  try {
    payload = (await req.json()) as GenerateMediaPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobId, jobType, images, propertyId } = payload;
  if (!jobId || !propertyId || !Array.isArray(images) || images.length === 0) {
    return NextResponse.json({ error: "Missing jobId, propertyId or images" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const now = () => new Date().toISOString();

  const updateJob = async (updates: JobUpdate) => {
    const { error } = await supabase
      .from("media_generation_jobs")
      .update({ ...updates, updated_at: now() })
      .eq("id", jobId);
    if (error) console.error("Failed to update job:", error);

    if (
      updates.output_video_url ||
      updates.output_video_vertical_url ||
      updates.output_tour_url ||
      updates.status
    ) {
      const propUpdates: Partial<PropertiesRow> = {
        media_generation_status: updates.status || "processing",
        media_generation_updated_at: now(),
      };
      if (updates.output_video_url) propUpdates.generated_video_url = updates.output_video_url;
      if (updates.output_video_vertical_url)
        propUpdates.generated_video_vertical_url = updates.output_video_vertical_url;
      if (updates.output_tour_url) propUpdates.generated_tour_url = updates.output_tour_url;
      if (updates.output_tour_type) propUpdates.generated_tour_type = updates.output_tour_type;
      await supabase.from("properties").update(propUpdates).eq("id", propertyId);
    }
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  try {
    await updateJob({ status: "processing", progress: 5, started_at: now() });

    const results: JobUpdate = {};

    if (jobType === "video" || jobType === "all") {
      // Simulated video pipeline (FFmpeg rendering is a future phase).
      await updateJob({ progress: 25 });
      await sleep(800);
      await updateJob({ progress: 50 });
      await sleep(800);
      await updateJob({ progress: 70 });

      const horizontalPath = `generated/${jobId}/video_horizontal.mp4`;
      const verticalPath = `generated/${jobId}/video_vertical.mp4`;
      const { data: horiz } = await supabase.storage
        .from("property-media")
        .upload(horizontalPath, new Blob(["placeholder horizontal video"], { type: "video/mp4" }), {
          upsert: true,
        });
      const { data: vert } = await supabase.storage
        .from("property-media")
        .upload(verticalPath, new Blob(["placeholder vertical video"], { type: "video/mp4" }), {
          upsert: true,
        });
      if (horiz)
        results.output_video_url = supabase.storage
          .from("property-media")
          .getPublicUrl(horizontalPath).data.publicUrl;
      if (vert)
        results.output_video_vertical_url = supabase.storage
          .from("property-media")
          .getPublicUrl(verticalPath).data.publicUrl;
      await updateJob({ progress: 78 });
    }

    if (jobType === "tour" || jobType === "all") {
      // Real walkthrough tour: self-contained HTML viewer with Ken Burns effect.
      await updateJob({ progress: 84 });
      const tourPath = `generated/${jobId}/tour.html`;
      const html = buildTourHtml(payload);
      const { data: tourUpload, error: tourError } = await supabase.storage
        .from("property-media")
        .upload(tourPath, new Blob([html], { type: "text/html" }), {
          upsert: true,
          contentType: "text/html; charset=utf-8",
        });
      if (tourError) throw new Error(`No se pudo subir el tour: ${tourError.message}`);
      if (tourUpload) {
        results.output_tour_url = supabase.storage
          .from("property-media")
          .getPublicUrl(tourPath).data.publicUrl;
        results.output_tour_type = "walkthrough";
      }
      await updateJob({ progress: 94 });
    }

    if (jobType === "social_cuts" || jobType === "all") {
      await updateJob({ progress: 97 });
    }

    await updateJob({ ...results, status: "done", progress: 100, completed_at: now() });

    return NextResponse.json({ success: true, jobId, ...results });
  } catch (error) {
    console.error("Media generation error:", error);
    await updateJob({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Error desconocido",
      completed_at: now(),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 },
    );
  }
}
