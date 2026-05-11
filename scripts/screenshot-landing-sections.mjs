// Capture the rebuilt three-audience landing page section by section.
//
// Requires: a local prod server already running on :3000.
// Each section is the nth direct child of <main>. We expand all <details>
// before shooting the FAQ section so the answers are visible.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = "docs/screenshots";
const VP = { w: 1280, h: 900 };

const SECTIONS = [
  { name: "landing-section-1-hero",       idx: 1 },
  { name: "landing-section-2-audiences",  idx: 2 },
  { name: "landing-section-3-problem",    idx: 3 },
  { name: "landing-section-4-approach",   idx: 4 },
  { name: "landing-section-5-principles", idx: 5 },
  { name: "landing-section-6-how",        idx: 6 },
  { name: "landing-section-7-faq",        idx: 7, expand: true },
  { name: "landing-section-8-cta",        idx: 8 },
  { name: "landing-section-9-sources",    idx: 9 },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: VP.w, height: VP.h },
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  // Allow fonts + lazy paint to settle.
  await page.waitForTimeout(800);

  for (const s of SECTIONS) {
    const sel = `main > section:nth-of-type(${s.idx})`;
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    if (s.expand) {
      // Open every <details> inside the FAQ section so all Q&A are visible.
      await page.evaluate((selector) => {
        const root = document.querySelector(selector);
        if (!root) return;
        root.querySelectorAll("details").forEach((d) => {
          d.open = true;
        });
      }, sel);
      await page.waitForTimeout(400);
      await el.scrollIntoViewIfNeeded();
    }
    const path = `${OUT}/${s.name}.png`;
    await el.screenshot({ path });
    console.log("✓", s.name);
  }

  await ctx.close();
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
