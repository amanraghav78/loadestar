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

test("the legal pages are reachable from the footer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Terms" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Terms of service" })).toBeVisible();
  await expect(page.getByRole("link", { name: "privacy policy" })).toBeVisible();
});

test("job type and industry filter the results", async ({ page }) => {
  await page.goto("/jobs");
  if ((page.viewportSize()?.width ?? 1280) < 1024) await page.locator("summary", { hasText: "Filters" }).click();

  await page.getByRole("link", { name: "Internship", exact: true }).click();
  await expect(page).toHaveURL(/employmentType=INTERNSHIP/);
  await expect(page.getByRole("link", { name: "Remove filter Internship" })).toBeVisible();

  // Filters combine, and each one can be removed on its own.
  await page.getByRole("link", { name: "Healthtech", exact: true }).click();
  await expect(page).toHaveURL(/industry=HEALTHTECH/);
  await page.getByRole("link", { name: "Remove filter Internship" }).click();
  await expect(page).toHaveURL(/industry=HEALTHTECH/);
  await expect(page).not.toHaveURL(/employmentType/);
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
