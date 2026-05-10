import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Sentinel.
 *
 * Tests live in `tests/e2e/`. Run with `npx playwright test`. CI uses the
 * same config (see .github/workflows/ci.yml).
 *
 * The dev server is auto-launched against an in-memory test fixture set; the
 * crisis-path test depends on a stubbed Resend webhook (see the test file).
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
