// Capture marketing-asset screenshots — viewport-only (no full-page) so the
// aspect ratio matches the device frames on the landing page.
//
// Requires: `npm run start` running with SCREENSHOT_BYPASS=1.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = "public/marketing";
const VETERAN_RED = "00000000-0000-4000-8000-0000000010a1";
const VETERAN_ORANGE = "00000000-0000-4000-8000-0000000010a2";
const COORDINATOR = "00000000-0000-4000-8000-00000000cccc";
const CLINICAL_LEAD = "00000000-0000-4000-8000-00000000bbbb";

const SHOTS = [
  // Phones — 9:19.5 (390 x 844) viewport
  { name: "product-veteran-home",     url: "/v",          as: VETERAN_RED,    vp: { w: 390, h: 844 } },
  { name: "product-veteran-checkin",  url: "/v/check-in", as: VETERAN_ORANGE, vp: { w: 390, h: 844 } },
  { name: "product-veteran-trends",   url: "/v/trends",   as: VETERAN_RED,    vp: { w: 390, h: 844 } },

  // Laptops — 16:10 (1280 x 800) viewport
  { name: "product-coordinator-queue",   url: "/coordinator",                            as: COORDINATOR,    vp: { w: 1280, h: 800 } },
  { name: "product-coordinator-veteran", url: `/coordinator/veteran/${VETERAN_RED}`,     as: COORDINATOR,    vp: { w: 1280, h: 800 } },
  { name: "product-clinical",            url: "/clinical",                               as: CLINICAL_LEAD,  vp: { w: 1280, h: 800 } },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const s of SHOTS) {
    const ctx = await browser.newContext({
      viewport: { width: s.vp.w, height: s.vp.h },
      deviceScaleFactor: 2,
      colorScheme: "light",
    });
    await ctx.addCookies([
      { name: "x-screenshot-as", value: s.as, url: "http://localhost:3000" },
    ]);
    const page = await ctx.newPage();
    await page.goto(`http://localhost:3000${s.url}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    // Settle: SSE/fonts/initial paint.
    await page.waitForTimeout(1600);
    const path = `${OUT}/${s.name}.png`;
    await page.screenshot({ path, fullPage: false });
    console.log("✓", s.name);
    await ctx.close();
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
