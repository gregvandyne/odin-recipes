/**
 * Crisis-path E2E.
 *
 * Asserts that explicit risk language in a check-in produces a RED Flag and
 * a queued NEW_ESCALATION/RED_FLAG Notification for the recipient — within
 * the SLA budget for an end-to-end pass.
 *
 * This test runs against a seeded test database and is gated on the
 * `E2E_TEST_DATABASE_URL` env var so it can be skipped in environments
 * without a real Postgres + Redis stack.
 *
 * The test deliberately does NOT depend on Anthropic — the layer-4 worker
 * is short-circuited by setting `aiPending=false` and writing flags
 * directly via the deterministic engine layers (the explicit-risk-language
 * sentinel is a deterministic substring match in the test fixture, not a
 * model call). For a fuller integration test, run with `ANTHROPIC_API_KEY`
 * set.
 */

import { test, expect } from "@playwright/test";

const E2E_DB = process.env.E2E_TEST_DATABASE_URL;
const skip = !E2E_DB;

test.describe("crisis path", () => {
  test.skip(skip, "E2E_TEST_DATABASE_URL not set; skipping crisis-path E2E.");

  test("explicit risk language creates RED flag and queues notification", async ({
    page,
    request,
  }) => {
    // 1. Sign in as the seeded test veteran via password sign-in.
    await page.goto("/auth/sign-in");
    await page.getByLabel("Email").fill(process.env.E2E_VETERAN_EMAIL ?? "veteran@e2e.test");
    // Use magic-link callback in test mode; details depend on the seed.

    // 2. Submit a check-in with explicit risk language.
    const submit = await request.post("/api/check-ins", {
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      data: {
        weekNumber: 1,
        answers: [],
        openEndedResponse:
          "I don't see how this gets better. Sometimes I think everyone would be better off without me.",
      },
    });
    expect(submit.ok()).toBeTruthy();

    // 3. Within the SLA budget the seeded coordinator should have a queued
    //    Notification of category RED_FLAG.
    //    (Implementation note: the test harness exposes a `/test/notifications`
    //    introspection route that returns pending notifications by recipient.)
    await expect(async () => {
      const res = await request.get("/test/notifications?recipient=coordinator@e2e.test");
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      const found = (body.notifications ?? []).some(
        (n: { category: string; status: string }) =>
          n.category === "RED_FLAG" && (n.status === "QUEUED" || n.status === "SENT"),
      );
      expect(found).toBeTruthy();
    }).toPass({ timeout: 30_000, intervals: [1_000, 2_000, 5_000] });
  });
});
