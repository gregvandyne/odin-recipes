import { test, expect } from "@playwright/test";

test.describe("sign-in page", () => {
  test("renders the magic-link form", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: /Send sign-in link/i })).toBeVisible();
  });

  test("password subsection is collapsed by default", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await expect(page.getByText("Use a password instead (staff only)")).toBeVisible();
    // Password input only visible after expanding.
    await expect(page.getByLabel("Password")).not.toBeVisible();
  });
});
