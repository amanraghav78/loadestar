import { expect, test } from "@playwright/test";

test("landing page matches the design's sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find the room where the work is real.");
  await expect(page.getByText(/open roles in product & engineering/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recommended for you" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browse by discipline" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hiring on Lodestar" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(6);
});

test("search, filter and open a role", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Job title, skill or company").fill("engineer");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/jobs\?q=engineer/);

  await page.getByLabel("Discipline").selectOption("ENGINEERING");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/discipline=ENGINEERING/);

  const first = page.getByRole("article").first();
  const title = (await first.getByRole("heading").textContent())!;
  await first.getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByRole("link", { name: /^Apply on/ })).toHaveAttribute("href", /^\/apply\//);
});
