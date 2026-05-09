// Screenshot script — captures every Sentinel surface in light AND dark mode
// at the appropriate viewport (mobile for veteran-facing, desktop for staff).
//
// Usage: node scripts/screenshot.mjs
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = "docs/screenshots";

const VETERAN_VW = { w: 390,  h: 844 };
const STAFF_VW   = { w: 1280, h: 900 };

const shots = [
  // Public landing
  { name: "01-landing",                  url: "/",                              vp: STAFF_VW,   fullPage: false, dark: true  },

  // Veteran app
  { name: "02-veteran-home",             url: "/v",                             vp: VETERAN_VW, fullPage: true,  dark: true  },
  { name: "03-veteran-check-in",         url: "/v/check-in",                    vp: VETERAN_VW, fullPage: false, dark: false },
  { name: "04-veteran-check-in-done",    url: "/v/check-in/done",               vp: VETERAN_VW, fullPage: false, dark: false },
  { name: "05-veteran-trends",           url: "/v/trends",                      vp: { w: 390, h: 1000 }, fullPage: true,  dark: false },
  { name: "06-veteran-onboarding",       url: "/v/onboarding",                  vp: VETERAN_VW, fullPage: true,  dark: false },
  { name: "07-veteran-consent",          url: "/v/onboarding/consent",          vp: VETERAN_VW, fullPage: true,  dark: false },
  { name: "08-veteran-messages",         url: "/v/messages",                    vp: VETERAN_VW, fullPage: false, dark: true  },

  // Staff
  { name: "09-coordinator-queue",        url: "/coordinator",                   vp: STAFF_VW,   fullPage: false, dark: true  },
  { name: "10-coordinator-veteran",      url: "/coordinator/veteran/demo-2",    vp: { w: 1400, h: 1100 }, fullPage: true,  dark: false },
  { name: "11-coordinator-messages",     url: "/coordinator/messages",          vp: STAFF_VW,   fullPage: false, dark: false },
  { name: "12-coordinator-thread",       url: "/coordinator/messages/t2",       vp: STAFF_VW,   fullPage: false, dark: false },
  { name: "13-clinical-escalations",     url: "/clinical",                      vp: STAFF_VW,   fullPage: false, dark: false },
  { name: "14-program-manager-cohort",   url: "/admin",                         vp: STAFF_VW,   fullPage: true,  dark: false },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const s of shots) {
    for (const mode of ["light", ...(s.dark ? ["dark"] : [])]) {
      const ctx = await browser.newContext({
        viewport: { width: s.vp.w, height: s.vp.h },
        deviceScaleFactor: 2,
        colorScheme: mode === "dark" ? "dark" : "light",
      });
      const page = await ctx.newPage();
      // Pre-set theme so next-themes picks it up on hydration without flicker.
      await page.addInitScript((m) => {
        try { localStorage.setItem("theme", m); } catch {}
      }, mode);
      await page.goto(`http://localhost:3000${s.url}`, { waitUntil: "domcontentloaded", timeout: 15000 });
      // Force the `dark` class — next-themes may not apply on a fresh load
      // with localStorage just set, especially before its provider mounts.
      if (mode === "dark") {
        await page.evaluate(() => document.documentElement.classList.add("dark"));
      } else {
        await page.evaluate(() => document.documentElement.classList.remove("dark"));
      }
      await page.waitForTimeout(900);
      const suffix = mode === "dark" ? "-dark" : "";
      const path = `${OUT}/${s.name}${suffix}.png`;
      await page.screenshot({ path, fullPage: s.fullPage });
      console.log("✓", s.name, mode);
      await ctx.close();
    }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
