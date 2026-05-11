// Capture screenshots of every Sentinel surface.
//
// Requires: `npm run start` running locally with SCREENSHOT_BYPASS=1 in the
// env. The bypass lets us mint an authenticated session via the
// `x-screenshot-as` cookie (env-gated; never active in production).
//
// Each authenticated shot sets `x-screenshot-as=<seeded-user-id>` before
// navigating. Veteran-facing surfaces use the seeded veteran #1 (RED),
// staff surfaces use the seeded coordinator.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = "docs/screenshots";

const DESKTOP = { w: 1280, h: 900 };
const DESKTOP_TALL = { w: 1280, h: 1600 };
const MOBILE = { w: 390, h: 844 };
const MOBILE_TALL = { w: 390, h: 1600 };

// Seeded users (from scripts/seed-screenshots.ts).
const VETERAN_RED = "00000000-0000-4000-8000-0000000010a1";
const VETERAN_ORANGE = "00000000-0000-4000-8000-0000000010a2";
const COORDINATOR = "00000000-0000-4000-8000-00000000cccc";
const PROGRAM_MANAGER = "00000000-0000-4000-8000-00000000aaaa";
const CLINICAL_LEAD = "00000000-0000-4000-8000-00000000bbbb";

const SHOTS = [
  // ---- Public ---------------------------------------------------------
  { name: "landing-light",         url: "/",                    vp: DESKTOP_TALL, full: true,  dark: false },
  { name: "landing-dark",          url: "/",                    vp: DESKTOP_TALL, full: true,  dark: true  },
  { name: "landing-mobile",        url: "/",                    vp: MOBILE_TALL,  full: true,  dark: false },

  // ---- Auth ----------------------------------------------------------
  { name: "auth-sign-in",          url: "/auth/sign-in",        vp: DESKTOP, full: false, dark: false },
  { name: "auth-sign-in-mobile",   url: "/auth/sign-in",        vp: MOBILE,  full: false, dark: false },
  { name: "auth-check-email",      url: "/auth/check-email?email=jordan%40example.com",
                                                                  vp: DESKTOP, full: false, dark: false },
  { name: "auth-error",            url: "/auth/error?error=Verification",
                                                                  vp: DESKTOP, full: false, dark: false },
  { name: "auth-suspended",        url: "/auth/account-suspended?reason=DEACTIVATED",
                                                                  vp: DESKTOP, full: false, dark: false },
  { name: "not-found",             url: "/this-does-not-exist", vp: DESKTOP, full: false, dark: false },

  // ---- Veteran (authenticated as a RED-scenario veteran) -------------
  { name: "v-home",                url: "/v",                   as: VETERAN_RED,    vp: MOBILE_TALL, full: true,  dark: false },
  { name: "v-trends",              url: "/v/trends",            as: VETERAN_RED,    vp: MOBILE_TALL, full: true,  dark: false },
  { name: "v-insights",            url: "/v/insights",          as: VETERAN_RED,    vp: MOBILE_TALL, full: true,  dark: false },
  { name: "v-messages",            url: "/v/messages",          as: VETERAN_RED,    vp: MOBILE_TALL, full: false, dark: false },
  { name: "v-profile",             url: "/v/profile",           as: VETERAN_RED,    vp: MOBILE_TALL, full: true,  dark: false },
  { name: "v-resources",           url: "/v/resources",         as: VETERAN_RED,    vp: MOBILE_TALL, full: true,  dark: false },
  { name: "v-check-in",            url: "/v/check-in",          as: VETERAN_ORANGE, vp: MOBILE,      full: false, dark: false },

  // ---- Coordinator ---------------------------------------------------
  { name: "coordinator-queue",         url: "/coordinator",                       as: COORDINATOR, vp: DESKTOP, full: false, dark: false },
  { name: "coordinator-queue-dark",    url: "/coordinator",                       as: COORDINATOR, vp: DESKTOP, full: false, dark: true  },
  { name: "coordinator-caseload",      url: "/coordinator/caseload",              as: COORDINATOR, vp: DESKTOP, full: true,  dark: false },
  { name: "coordinator-veteran",       url: `/coordinator/veteran/${VETERAN_RED}`, as: COORDINATOR, vp: { w: 1400, h: 1600 }, full: true,  dark: false },
  { name: "coordinator-messages-list", url: "/coordinator/messages",              as: COORDINATOR, vp: DESKTOP, full: false, dark: false },

  // ---- Clinical ------------------------------------------------------
  { name: "clinical-escalations",   url: "/clinical",        as: CLINICAL_LEAD, vp: DESKTOP, full: false, dark: false },
  { name: "clinical-recent",        url: "/clinical/recent", as: CLINICAL_LEAD, vp: DESKTOP, full: false, dark: false },

  // ---- Admin (program manager) ---------------------------------------
  { name: "admin-dashboard",        url: "/admin",                vp: DESKTOP_TALL, as: PROGRAM_MANAGER, full: true,  dark: false },
  { name: "admin-coordinators",     url: "/admin/coordinators",   vp: DESKTOP,      as: PROGRAM_MANAGER, full: false, dark: false },
  { name: "admin-audit",            url: "/admin/audit",          vp: DESKTOP,      as: PROGRAM_MANAGER, full: false, dark: false },
  { name: "admin-settings",         url: "/admin/settings",       vp: DESKTOP,      as: PROGRAM_MANAGER, full: false, dark: false },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const s of SHOTS) {
    const ctx = await browser.newContext({
      viewport: { width: s.vp.w, height: s.vp.h },
      deviceScaleFactor: 2,
      colorScheme: s.dark ? "dark" : "light",
    });
    if (s.as) {
      await ctx.addCookies([
        {
          name: "x-screenshot-as",
          value: s.as,
          url: "http://localhost:3000",
        },
      ]);
    }
    const page = await ctx.newPage();
    await page.addInitScript((mode) => {
      try {
        localStorage.setItem("theme", mode);
      } catch {}
    }, s.dark ? "dark" : "light");
    // domcontentloaded — not networkidle — because staff surfaces hold an
    // SSE connection open and networkidle would never settle.
    await page.goto(`http://localhost:3000${s.url}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (s.dark) {
      await page.evaluate(() => document.documentElement.classList.add("dark"));
    } else {
      await page.evaluate(() => document.documentElement.classList.remove("dark"));
    }
    // Wait for fonts + initial paint to settle. SSE-streaming surfaces
    // need a moment after DOMContentLoaded for the rendered content to land.
    await page.waitForTimeout(s.as ? 1500 : 900);
    const path = `${OUT}/${s.name}.png`;
    await page.screenshot({ path, fullPage: s.full });
    console.log("✓", s.name);
    await ctx.close();
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
