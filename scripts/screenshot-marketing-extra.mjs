// Capture additional marketing screenshots:
//   - product-coordinator-queue-alt.png — dark-mode variant of the queue
//     for the second occurrence in the product gallery.
//   - product-veteran-checkin.png — replaces the boring sleep-hours
//     screen with the more visually engaging LIKERT step (5 anchors).
//
// Requires: `npm run start` running with SCREENSHOT_BYPASS=1.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = "public/marketing";
const VETERAN_ORANGE = "00000000-0000-4000-8000-0000000010a2";
const COORDINATOR = "00000000-0000-4000-8000-00000000cccc";

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  // 1) Queue alt — dark mode
  {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
      colorScheme: "dark",
    });
    await ctx.addCookies([
      { name: "x-screenshot-as", value: COORDINATOR, url: "http://localhost:3000" },
      { name: "theme", value: "dark", url: "http://localhost:3000" },
    ]);
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      try { localStorage.setItem("theme", "dark"); } catch {}
    });
    await page.goto("http://localhost:3000/coordinator", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    // Force-toggle the document if the app hasn't applied dark yet.
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${OUT}/product-coordinator-queue-alt.png`, fullPage: false });
    console.log("✓ product-coordinator-queue-alt");
    await ctx.close();
  }

  // 2) Check-in — advance past the hours question to the LIKERT step.
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      colorScheme: "light",
    });
    await ctx.addCookies([
      { name: "x-screenshot-as", value: VETERAN_ORANGE, url: "http://localhost:3000" },
    ]);
    const page = await ctx.newPage();
    await page.goto("http://localhost:3000/v/check-in", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(800);

    // Fill the sleep-hours input and blur to advance to the LIKERT question.
    const hours = page.locator('input[type="number"]').first();
    await hours.waitFor({ state: "visible", timeout: 10000 });
    await hours.fill("7");
    // Click the page background to blur and trigger onAnswer.
    await page.locator("body").click({ position: { x: 10, y: 10 } });
    // Wait for the LIKERT options to render.
    await page.waitForSelector('button[role="radio"]', { timeout: 10000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/product-veteran-checkin.png`, fullPage: false });
    console.log("✓ product-veteran-checkin");
    await ctx.close();
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
