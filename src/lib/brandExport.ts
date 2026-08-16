// Client-side rasterisation helpers for the /brand asset library.
// Turns the inline SVG marks into PNG downloads (opaque or transparent)
// and composes social banners on a canvas.

import { BRAND_COLORS as C } from "@/lib/brand";

export function triggerDownload(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`;
}

function loadSvgImage(svg: SVGSVGElement): Promise<HTMLImageElement> {
  const source = serializeSvg(svg);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not rasterise the mark"));
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png"),
  );
}

/**
 * Rasterise a mark to a square PNG.
 * `background: null` keeps it transparent, `"arena"` paints the brand gradient,
 * any other string is used as a flat fill.
 */
export async function markToPng(
  svg: SVGSVGElement,
  size: number,
  background: string | null,
): Promise<Blob> {
  const img = await loadSvgImage(svg);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  if (background === "arena") {
    const g = ctx.createLinearGradient(0, size, size, 0);
    g.addColorStop(0, C.obsidian);
    g.addColorStop(0.55, C.imperial);
    g.addColorStop(1, C.gold);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  } else if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
  }
  const pad = Math.round(size * 0.06);
  ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);
  return toBlob(canvas);
}

export type BannerPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  note: string;
};

export const BANNER_PRESETS: BannerPreset[] = [
  { id: "og", label: "Social / OG card", width: 1200, height: 630, note: "Telegram, X and link previews" },
  { id: "x", label: "X / Twitter header", width: 1500, height: 500, note: "Profile cover" },
  { id: "square", label: "Square post", width: 1080, height: 1080, note: "Announcements, TG stickers" },
  { id: "tg", label: "Telegram group banner", width: 1280, height: 320, note: "Group / channel header" },
];

export type BannerStyle = "arena" | "obsidian" | "bone";

async function ensureFonts() {
  try {
    await document.fonts.load("400 64px Anton");
    await document.fonts.load('500 24px "Space Grotesk"');
    await document.fonts.ready;
  } catch {
    /* fall back to system fonts */
  }
}

/** Compose a banner: mark + wordmark + tagline on one of three backgrounds. */
export async function bannerToPng(
  svg: SVGSVGElement,
  preset: BannerPreset,
  style: BannerStyle,
  tagline: string,
): Promise<Blob> {
  await ensureFonts();
  const img = await loadSvgImage(svg);
  const { width: w, height: h } = preset;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  if (style === "arena") {
    const g = ctx.createLinearGradient(0, h, w, 0);
    g.addColorStop(0, C.obsidian);
    g.addColorStop(0.55, C.imperial);
    g.addColorStop(1, C.gold);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = style === "bone" ? C.bone : C.obsidian;
  }
  ctx.fillRect(0, 0, w, h);

  const onDark = style !== "bone";
  const wordColor = onDark ? C.bone : C.obsidian;
  const accentColor = style === "bone" ? C.imperial : C.lime;
  const stacked = preset.id === "square";

  const short = Math.min(w, h);
  const markSize = stacked ? short * 0.32 : short * 0.5;
  const titleSize = stacked ? short * 0.13 : short * 0.22;
  const tagSize = titleSize * 0.26;
  const display = '400 ' + titleSize + 'px Anton, "Arial Narrow", sans-serif';

  ctx.textBaseline = "middle";
  ctx.font = display;
  const partA = "BRUH";
  const partB = " LEGENDS";
  const wA = ctx.measureText(partA).width;
  const wB = ctx.measureText(partB).width;
  const textW = wA + wB;

  const drawWord = (x: number, y: number) => {
    ctx.font = display;
    ctx.textAlign = "left";
    ctx.fillStyle = accentColor;
    ctx.fillText(partA, x, y);
    ctx.fillStyle = wordColor;
    ctx.fillText(partB, x + wA, y);
  };

  const tagFont = '500 ' + tagSize + 'px "Space Grotesk", system-ui, sans-serif';

  if (stacked) {
    const cx = w / 2;
    ctx.drawImage(img, cx - markSize / 2, h * 0.26 - markSize / 2, markSize, markSize);
    drawWord(cx - textW / 2, h * 0.58);
    if (tagline) {
      ctx.font = tagFont;
      ctx.textAlign = "center";
      ctx.fillStyle = onDark ? C.bone : C.obsidian;
      ctx.globalAlpha = 0.8;
      ctx.fillText(tagline, cx, h * 0.58 + titleSize * 0.85);
      ctx.globalAlpha = 1;
    }
  } else {
    const gap = short * 0.09;
    const blockW = markSize + gap + textW;
    const startX = (w - blockW) / 2;
    ctx.drawImage(img, startX, h / 2 - markSize / 2, markSize, markSize);
    const textX = startX + markSize + gap;
    const baseline = tagline ? h / 2 - tagSize * 0.7 : h / 2;
    drawWord(textX, baseline);
    if (tagline) {
      ctx.font = tagFont;
      ctx.textAlign = "left";
      ctx.fillStyle = onDark ? C.bone : C.obsidian;
      ctx.globalAlpha = 0.8;
      ctx.fillText(tagline, textX, baseline + titleSize * 0.72);
      ctx.globalAlpha = 1;
    }
  }

  return toBlob(canvas);
}
