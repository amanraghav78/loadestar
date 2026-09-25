import { expect, test } from "@playwright/test";

const ADMIN_USER = process.env.ADMIN_USER ?? "admin";
const ADMIN_PASS = process.env.ADMIN_PASS ?? "local-dev-password";
const CRON_SECRET = process.env.CRON_SECRET ?? "local-dev-cron-secret-0000";

test("Apply redirects to the employer's own application page", async ({ page, request }) => {
  await page.goto("/jobs?q=ingest");
  await page.getByRole("article").first().getByRole("link").first().click();
  const href = await page.getByRole("link", { name: /^Apply now/ }).getAttribute("href");

  const res = await request.get(href!, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers()["location"]).toMatch(/^https:\/\//);
  expect(res.headers()["cache-control"]).toContain("no-store");
});

test("saved roles persist across reloads without an account", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  // No count is shown until something is saved.
  await expect(header.getByRole("link", { name: /Saved/ })).not.toContainText(/\d/);

  const card = page.getByRole("article").first();
  const title = (await card.getByRole("heading").textContent())!;
  await card.getByRole("button", { name: `Save ${title}` }).click();
  await expect(header.getByRole("link", { name: /Saved/ })).toContainText("1");

  await page.reload();
  await expect(header.getByRole("link", { name: /Saved/ })).toContainText("1");

  await page.goto("/saved");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article").getByRole("heading")).toHaveText(title);

  await page.getByRole("button", { name: `Remove ${title} from saved roles` }).click();
  await expect(page.getByText("No saved jobs yet")).toBeVisible();
});

// With Cache Components the static shell streams first (status 200), so a
// missing role is a "soft 404": not-found UI plus a noindex tag.
test("unknown roles show not-found and are not indexable", async ({ page }) => {
  await page.goto("/jobs/this-role-does-not-exist");
  await expect(page.getByRole("heading", { name: /This page isn.t here/ })).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
});

test("admin requires credentials", async ({ request }) => {
  expect((await request.get("/admin")).status()).toBe(401);
  const wrong = await request.get("/admin", {
    headers: { Authorization: `Basic ${Buffer.from(`${ADMIN_USER}:wrong`).toString("base64")}` },
  });
  expect(wrong.status()).toBe(401);
});

test("cron endpoint requires the secret", async ({ request }) => {
  expect((await request.get("/api/cron/expire")).status()).toBe(401);
  const ok = await request.get("/api/cron/expire", { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toHaveProperty("expired");
});

test.describe("admin", () => {
  test.use({ httpCredentials: { username: ADMIN_USER, password: ADMIN_PASS } });

  test("publishing a role makes it searchable, taking it down hides it", async ({ page }) => {
    const title = `E2E Rust Engineer ${Date.now()}`;

    await page.goto("/admin/jobs/new");
    await page.getByLabel("Title").fill(title);
    await page.getByRole("combobox", { name: "Company" }).selectOption({ label: "Vellum" });
    await page.getByLabel("Salary min").fill("2500000");
    await page.getByLabel("Salary max").fill("3500000");
    await page.getByLabel("Location", { exact: true }).fill("Bengaluru");
    await page.getByLabel("Apply URL").fill("https://forms.gle/e2e-test");
    await page.getByLabel("Tags").fill("Rust, E2E");
    await page.getByLabel("Description").fill("An end-to-end test listing that is long enough to pass validation.");
    await page.getByRole("button", { name: "Publish role" }).click();
    await expect(page.getByRole("status")).toContainText("Saved.");

    // Public search is uncached for new query strings, so it is visible immediately.
    await page.goto(`/jobs?q=${encodeURIComponent(title)}`);
    await expect(page.getByRole("article")).toHaveCount(1);

    await page.goto(`/admin?q=${encodeURIComponent(title)}`);
    await page.getByRole("button", { name: "Take down" }).click();
    await page.goto(`/admin?q=${encodeURIComponent(title)}&status=EXPIRED`);
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  });

  test("invalid listings are rejected with field errors", async ({ page }) => {
    await page.goto("/admin/jobs/new");
    await page.getByLabel("Title").fill("No band");
    await page.getByRole("button", { name: "Publish role" }).click();
    await expect(page.getByText("Please fix the highlighted fields.")).toBeVisible();
  });
});
