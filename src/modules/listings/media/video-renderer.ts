/**
 * Browser-side property video renderer.
 *
 * Draws the listing photos onto a 1280×720 canvas with a Ken Burns effect
 * (slow zoom + crossfade) plus text overlays (title, price, location, size),
 * and records the result with MediaRecorder. Runs fully client-side, so there
 * are no serverless timeouts and no per-video cost.
 */

export type VideoRenderInput = {
  imageUrls: string[];
  title?: string;
  priceLabel?: string;
  locationLabel?: string;
  sizeLabel?: string;
};

export type RenderedVideo = {
  blob: Blob;
  ext: "mp4" | "webm";
};

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const MAX_TOTAL_SECONDS = 30;
const SECONDS_PER_IMAGE = 2.8;
const CROSSFADE_SECONDS = 0.5;
const TITLE_SECONDS = 3;

const MIME_CANDIDATES: { mime: string; ext: "mp4" | "webm" }[] = [
  { mime: "video/mp4", ext: "mp4" },
  { mime: "video/webm;codecs=vp9", ext: "webm" },
  { mime: "video/webm;codecs=vp8", ext: "webm" },
  { mime: "video/webm", ext: "webm" },
];

function pickMimeType(): { mime: string; ext: "mp4" | "webm" } | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate.mime)) return candidate;
  }
  return null;
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Draw image covering the canvas (object-fit: cover) with a scale factor. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  scale: number,
  panX: number,
  panY: number,
) {
  const imgRatio = img.width / img.height;
  const canvasRatio = WIDTH / HEIGHT;
  let drawW: number;
  let drawH: number;
  if (imgRatio > canvasRatio) {
    drawH = HEIGHT;
    drawW = HEIGHT * imgRatio;
  } else {
    drawW = WIDTH;
    drawH = WIDTH / imgRatio;
  }
  drawW *= scale;
  drawH *= scale;
  const maxPanX = (drawW - WIDTH) / 2;
  const maxPanY = (drawH - HEIGHT) / 2;
  const x = (WIDTH - drawW) / 2 + panX * maxPanX;
  const y = (HEIGHT - drawH) / 2 + panY * maxPanY;
  ctx.drawImage(img, x, y, drawW, drawH);
}

function drawOverlays(
  ctx: CanvasRenderingContext2D,
  input: VideoRenderInput,
  elapsed: number,
) {
  // Bottom gradient bar with price / location / size.
  const barHeight = 96;
  const gradient = ctx.createLinearGradient(0, HEIGHT - barHeight, 0, HEIGHT);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, HEIGHT - barHeight, WIDTH, barHeight);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";

  if (input.priceLabel) {
    ctx.font = "bold 40px system-ui, -apple-system, sans-serif";
    ctx.fillText(input.priceLabel, 48, HEIGHT - 30);
  }

  const right = [input.locationLabel, input.sizeLabel].filter(Boolean).join("  ·  ");
  if (right) {
    ctx.font = "28px system-ui, -apple-system, sans-serif";
    const width = ctx.measureText(right).width;
    ctx.fillText(right, WIDTH - 48 - width, HEIGHT - 34);
  }

  // Title overlay for the first seconds of the video.
  if (input.title && elapsed < TITLE_SECONDS) {
    const fade =
      elapsed < TITLE_SECONDS - 0.5
        ? Math.min(1, elapsed / 0.4)
        : Math.max(0, (TITLE_SECONDS - elapsed) / 0.5);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 240, WIDTH, 150);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 54px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    const title =
      input.title.length > 60 ? `${input.title.slice(0, 57)}…` : input.title;
    ctx.fillText(title, WIDTH / 2, 330);
    ctx.restore();
    ctx.textAlign = "left";
  }
}

/**
 * Render the video and return the recorded blob.
 * Runs in real time (~images × 2.8s, capped at 30s); keep the tab visible.
 */
export async function renderPropertyVideo(
  input: VideoRenderInput,
  onProgress?: (percent: number) => void,
): Promise<RenderedVideo> {
  const picked = pickMimeType();
  if (!picked) {
    throw new Error(
      "Tu navegador no soporta la grabación de video. Prueba con Chrome, Edge o Safari actualizado.",
    );
  }

  const loaded = await Promise.all(input.imageUrls.map(loadImage));
  const images = loaded.filter((img): img is HTMLImageElement => img !== null);
  if (images.length === 0) {
    throw new Error(
      "No se pudieron cargar las imágenes para el video. Verifica que las URLs sean accesibles.",
    );
  }

  const perImage = Math.min(
    SECONDS_PER_IMAGE,
    MAX_TOTAL_SECONDS / images.length,
  );
  const totalMs = images.length * perImage * 1000;
  const crossfadeMs = Math.min(CROSSFADE_SECONDS, perImage / 2) * 1000;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo inicializar el lienzo de video.");

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, {
    mimeType: picked.mime,
    videoBitsPerSecond: 2_000_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start(250);
  const start = performance.now();

  await new Promise<void>((resolve) => {
    const frame = () => {
      const elapsed = performance.now() - start;
      if (elapsed >= totalMs) {
        resolve();
        return;
      }

      const index = Math.min(
        images.length - 1,
        Math.floor(elapsed / (perImage * 1000)),
      );
      const current = images[index];
      if (!current) {
        resolve();
        return;
      }
      const imageStart = index * perImage * 1000;
      const t = (elapsed - imageStart) / (perImage * 1000); // 0..1 within image

      // Alternate zoom-in / zoom-out per image, with a slight drift.
      const zoomIn = index % 2 === 0;
      const scale = zoomIn ? 1 + 0.12 * t : 1.12 - 0.12 * t;
      const pan = zoomIn ? t * 0.6 : (1 - t) * 0.6;

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      drawCover(ctx, current, scale, pan - 0.3, 0);

      // Crossfade into the next image at the end of each segment.
      const remaining = imageStart + perImage * 1000 - elapsed;
      const next = images[index + 1];
      if (next && remaining < crossfadeMs) {
        const alpha = 1 - remaining / crossfadeMs;
        ctx.save();
        ctx.globalAlpha = alpha;
        drawCover(ctx, next, 1, 0, 0);
        ctx.restore();
      }

      drawOverlays(ctx, input, elapsed / 1000);
      onProgress?.(Math.min(99, Math.round((elapsed / totalMs) * 100)));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  onProgress?.(100);

  const blob = new Blob(chunks, { type: picked.mime });
  if (blob.size === 0) {
    throw new Error("El video generado quedó vacío. Intenta de nuevo.");
  }
  return { blob, ext: picked.ext };
}
