// Screenshot script — renders each Sentinel page at the appropriate viewport
// (mobile for veteran-facing, desktop for staff) and saves to /docs/screenshots.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = "docs/screenshots";

const shots = [
  // Public landing — desktop framing
  { name: "01-landing",                  url: "/",                              w: 1280, h: 900,  fullPage: false },

  // Veteran app (mobile-first, iPhone-ish viewport)
  { name: "02-veteran-home",             url: "/v",                             w: 390,  h: 844,  fullPage: false },
  { name: "03-veteran-check-in",         url: "/v/check-in",                    w: 390,  h: 844,  fullPage: false },
  { name: "04-veteran-check-in-done",    url: "/v/check-in/done",               w: 390,  h: 844,  fullPage: false },
  { name: "05-veteran-trends",           url: "/v/trends",                      w: 390,  h: 900,  fullPage: true  },
  { name: "06-veteran-onboarding",       url: "/v/onboarding",                  w: 390,  h: 900,  fullPage: true  },
  { name: "07-veteran-consent",          url: "/v/onboarding/consent",          w: 390,  h: 900,  fullPage: true  },

  // Staff surfaces (desktop)
  { name: "08-coordinator-queue",        url: "/coordinator",                   w: 1280, h: 900,  fullPage: false },
  { name: "09-coordinator-veteran",      url: "/coordinator/veteran/demo-2",    w: 1280, h: 900,  fullPage: true  },
  { name: "10-clinical-escalations",     url: "/clinical",                      w: 1280, h: 900,  fullPage: false },
  { name: "11-program-manager-cohort",   url: "/admin",                         w: 1280, h: 900,  fullPage: true  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const s of shots) {
    const ctx = await browser.newContext({
      viewport: { width: s.w, height: s.h },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:3000${s.url}`, { waitUntil: "domcontentloaded", timeout: 15000 });
    // Brief settle for fonts and any client hydration
    await page.waitForTimeout(800);
    const path = `${OUT}/${s.name}.png`;
    await page.screenshot({ path, fullPage: s.fullPage });
    console.log("✓", s.name, "→", path);
    await ctx.close();
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
