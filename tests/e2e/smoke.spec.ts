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

test("sorting keeps the search and filters, and starts from the first page", async ({ page }) => {
  await page.goto("/jobs?q=engineer");
  const sort = page.getByRole("navigation", { name: "Sort jobs" });
  await expect(sort.getByRole("link", { name: "Recommended" })).toHaveAttribute("aria-current", "true");

  await sort.getByRole("link", { name: "Highest salary" }).click();
  await expect(page).toHaveURL(/\/jobs\?q=engineer&sort=salary$/);
  await expect(sort.getByRole("link", { name: "Highest salary" })).toHaveAttribute("aria-current", "true");

  // A filter keeps the order, and the next page carries both.
  if ((page.viewportSize()?.width ?? 1280) < 1024) await page.locator("summary", { hasText: "Filters" }).click();
  await page.getByRole("link", { name: "Engineering", exact: true }).click();
  await expect(page).toHaveURL(/sort=salary/);
  await expect(page).toHaveURL(/discipline=ENGINEERING/);

  await page.goto("/jobs?sort=salary");
  await page.getByRole("link", { name: /More jobs/ }).click();
  await expect(page).toHaveURL(/sort=salary&cursor=/);

  // Changing the order drops the cursor, and the default stays out of the URL.
  await page.getByRole("navigation", { name: "Sort jobs" }).getByRole("link", { name: "Newest" }).click();
  await expect(page).toHaveURL(/\/jobs\?sort=newest$/);
  await page.getByRole("navigation", { name: "Sort jobs" }).getByRole("link", { name: "Recommended" }).click();
  await expect(page).toHaveURL(/\/jobs$/);
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

test("the home page carries a share image and site structured data", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https?:\/\/.+\/opengraph-image/);
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", /Your Next Job Awaits/);

  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const graph = blocks.flatMap((text) => (JSON.parse(text)["@graph"] ?? []) as { "@type": string }[]);
  expect(graph.find((node) => node["@type"] === "WebSite")).toMatchObject({
    potentialAction: {
      "@type": "SearchAction",
      target: { urlTemplate: expect.stringMatching(/\/jobs\?q=\{search_term_string\}$/) },
    },
  });
  expect(graph.some((node) => node["@type"] === "Organization")).toBe(true);
});

test("a job's share image names the role and is served as a PNG", async ({ page, request }) => {
  await page.goto("/jobs");
  const first = page.getByRole("article").first();
  const title = (await first.getByRole("heading").textContent())!.trim();
  await first.getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

  const image = page.locator('meta[property="og:image"]');
  await expect(image).toHaveAttribute("content", /\/jobs\/[^/]+\/opengraph-image/);
  const alt = await page.locator('meta[property="og:image:alt"]').getAttribute("content");
  expect(alt).toContain(`${title} at `);

  const res = await request.get((await image.getAttribute("content"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^image\/png/);
});

test("an unknown job's share image falls back to the site image", async ({ request }) => {
  const res = await request.get("/jobs/no-such-role-000000/opengraph-image/card");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^image\/png/);
});
