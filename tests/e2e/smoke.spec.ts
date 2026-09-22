import { expect, test } from "@playwright/test";

test("landing page shows the tagline, search and browse sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your Next Job Awaits.");
  await expect(page.getByText(/live jobs across India/i)).toBeVisible();
  await expect(page.getByText("Only real jobs. No spam.").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Latest jobs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browse by category" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top companies hiring" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(6);
});

test("search, filter and open a role", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Job title, skill or company").fill("engineer");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/jobs\?q=engineer/);

  // Below the lg breakpoint the filters sit behind a "Filters" toggle.
  if ((page.viewportSize()?.width ?? 1280) < 1024) await page.locator("summary", { hasText: "Filters" }).click();
  await page.getByRole("link", { name: "Engineering", exact: true }).click();
  await expect(page).toHaveURL(/discipline=ENGINEERING/);
  await expect(page.getByRole("link", { name: "Remove filter Engineering" })).toBeVisible();

  const first = page.getByRole("article").first();
  const title = (await first.getByRole("heading").textContent())!;
  await first.getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByRole("link", { name: /^Apply now/ })).toHaveAttribute("href", /^\/apply\//);
});
