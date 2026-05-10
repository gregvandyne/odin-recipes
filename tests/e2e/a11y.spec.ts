/**
 * Accessibility CI scans. Runs axe-core against the public + key staff
 * pages. Fails on serious/critical violations.
 *
 * Requires `@axe-core/playwright`. If the package isn't installed (e.g. dev
 * machine without it), the test skips instead of failing the suite.
 */
import { test, expect } from "@playwright/test";

const PAGES_TO_SCAN = ["/", "/auth/sign-in"];

interface AxeViolation {
  impact?: "minor" | "moderate" | "serious" | "critical" | null;
  id: string;
  description: string;
}

test.describe("accessibility", () => {
  for (const path of PAGES_TO_SCAN) {
    test(`no serious/critical axe violations on ${path}`, async ({ page }) => {
      // Dynamic resolution so the optional package can be absent in dev.
      let AxeBuilderCtor:
        | (new (args: { page: typeof page }) => { analyze(): Promise<{ violations: AxeViolation[] }> })
        | null = null;
      try {
        const moduleName = "@axe-core/playwright";
        const mod = (await import(/* webpackIgnore: true */ moduleName)) as {
          default: new (args: { page: typeof page }) => { analyze(): Promise<{ violations: AxeViolation[] }> };
        };
        AxeBuilderCtor = mod.default;
      } catch {
        test.skip(true, "@axe-core/playwright not installed; skipping a11y scan");
        return;
      }
      if (!AxeBuilderCtor) {
        test.skip(true, "@axe-core/playwright not available");
        return;
      }
      await page.goto(path);
      const results = await new AxeBuilderCtor({ page }).analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      if (serious.length > 0) {
        console.log(JSON.stringify(serious, null, 2));
      }
      expect(serious).toEqual([]);
    });
  }
});
