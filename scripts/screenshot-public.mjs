// Capture screenshots of the public + unauthenticated surfaces only.
// These don't need a real database session.
//
// Usage: `npm run start` in one shell, then `node scripts/screenshot-public.mjs`.
//
// Outputs to docs/screenshots/landing-* — kept separate from the
// full-app snapshot set so we can regenerate landing visuals without
// touching the rest of the deck.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = "docs/screenshots";

const DESKTOP = { w: 1280, h: 900 };
const MOBILE = { w: 390, h: 844 };
const TALL = { w: 1280, h: 1600 };

const SHOTS = [
  // Landing — full-page light & dark, plus a mobile view
  { name: "landing-light", url: "/", vp: TALL, fullPage: true, dark: false },
  { name: "landing-dark", url: "/", vp: TALL, fullPage: true, dark: true },
  { name: "landing-mobile", url: "/", vp: { w: 390, h: 1600 }, fullPage: true, dark: false },

  // Sign-in
  { name: "auth-sign-in", url: "/auth/sign-in", vp: DESKTOP, fullPage: false, dark: false },
  { name: "auth-sign-in-mobile", url: "/auth/sign-in", vp: MOBILE, fullPage: false, dark: false },

  // Check-email
  {
    name: "auth-check-email",
    url: "/auth/check-email?email=jordan%40example.com",
    vp: DESKTOP,
    fullPage: false,
    dark: false,
  },

  // Auth error
  {
    name: "auth-error",
    url: "/auth/error?error=Verification",
    vp: DESKTOP,
    fullPage: false,
    dark: false,
  },

  // Account suspended
  {
    name: "auth-account-suspended",
    url: "/auth/account-suspended?reason=DEACTIVATED",
    vp: DESKTOP,
    fullPage: false,
    dark: false,
  },

  // 404
  { name: "not-found", url: "/this-does-not-exist", vp: DESKTOP, fullPage: false, dark: false },
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
    const page = await ctx.newPage();
    // Pre-set theme so next-themes picks it up without flicker.
    await page.addInitScript((mode) => {
      try {
        localStorage.setItem("theme", mode);
      } catch {}
    }, s.dark ? "dark" : "light");
    await page.goto(`http://localhost:3000${s.url}`, {
      waitUntil: "networkidle",
      timeout: 20000,
    });
    if (s.dark) {
      await page.evaluate(() => document.documentElement.classList.add("dark"));
    } else {
      await page.evaluate(() => document.documentElement.classList.remove("dark"));
    }
    await page.waitForTimeout(800);
    const path = `${OUT}/${s.name}.png`;
    await page.screenshot({ path, fullPage: s.fullPage });
    console.log("✓", s.name);
    await ctx.close();
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
