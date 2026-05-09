/**
 * Generate restrained Sentinel PWA icons as raster PNGs.
 *
 * Pure Node (no Sharp/Canvas dependency) — uses a tiny embedded PNG generator.
 * The icon is the wordmark "S" on the muted slate-blue accent, on the calm
 * off-white canvas. No gradients, no glyph art.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { createCanvas, registerFont } from "canvas";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(resolve(root, "public/icons"), { recursive: true });

function drawIcon(size, { maskable = false } = {}) {
  const c = createCanvas(size, size);
  const ctx = c.getContext("2d");

  // Background
  if (maskable) {
    // For maskable icons, fill the full bleed with the brand color so OS
    // shape masks (circle, squircle) crop cleanly.
    ctx.fillStyle = "#3B5B7E";
    ctx.fillRect(0, 0, size, size);
  } else {
    // Soft canvas with rounded corners + brand color square inset.
    ctx.fillStyle = "#FAFAF7";
    ctx.fillRect(0, 0, size, size);
    const inset = size * 0.12;
    const r = size * 0.18;
    roundedRect(ctx, inset, inset, size - inset * 2, size - inset * 2, r);
    ctx.fillStyle = "#3B5B7E";
    ctx.fill();
  }

  // Wordmark "S" — use generic sans-serif so node-canvas falls back to a real system font.
  ctx.fillStyle = "#FFFFFF";
  const fontPx = Math.round(size * (maskable ? 0.55 : 0.6));
  ctx.font = `bold ${fontPx}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const offset = maskable ? 0 : size * 0.02;
  ctx.fillText("S", size / 2, size / 2 + offset);

  return c;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function save(canvas, name) {
  const path = resolve(root, "public/icons", name);
  writeFileSync(path, canvas.toBuffer("image/png"));
  console.log("✓", path);
}

save(drawIcon(192),                    "icon-192.png");
save(drawIcon(512),                    "icon-512.png");
save(drawIcon(192, { maskable: true }),"icon-mask-192.png");
save(drawIcon(512, { maskable: true }),"icon-mask-512.png");
save(drawIcon(72),                     "badge-72.png");
save(drawIcon(180),                    "apple-touch-icon.png");
