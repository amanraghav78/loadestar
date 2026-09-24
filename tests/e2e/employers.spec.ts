import { expect, test, type Page } from "@playwright/test";

/**
 * The employer side, end to end: a candidate account becomes an employer
 * account, claims a company, gets verified, posts a role, and the role only
 * becomes public once an admin approves it.
 *
 * Signing in goes through the test-only hook, as in account.spec.ts — Google's
 * consent screen can't be automated.
 */

const ADMIN_USER = process.env.ADMIN_USER ?? "admin";
const ADMIN_PASS = process.env.ADMIN_PASS ?? "local-dev-password";
const PASSWORD = "e2e-password-1234";

/** A fresh account per test and per run, so no test inherits a claim. */
const RUN = Date.now().toString(36);
const recruiter = (label: string) => `e2e-rec-${label}-${RUN}@example.test`;

async function signIn(page: Page, email: string, name = "Riya Recruiter") {
  const res = await page.request.post("/api/test/sign-in", { data: { email, name, password: PASSWORD } });
  expect(res.ok(), `test sign-in failed: ${res.status()}`).toBe(true);
}

/** Signed in → employer account → claim submitted for Vellum. */
async function claimVellum(page: Page, email: string) {
  await signIn(page, email);
  await page.goto("/employers");
  await page.getByRole("button", { name: "Continue as an employer" }).click();

  await expect(page.getByRole("heading", { name: /Which company do you hire for/ })).toBeVisible();
  await page.getByRole("combobox", { name: "Your company" }).selectOption({ label: "Vellum" });
  await page.getByLabel("Work email").fill(`riya@vellum.example.com`);
  await page.getByRole("button", { name: "Request access" }).click();
  await expect(page.getByRole("status")).toContainText(/with us|verify/i);
}

test.describe("employers", () => {
  test("signed-out visitors are offered sign-in, not a form", async ({ page }) => {
    await page.goto("/employers");
    await expect(page.getByRole("heading", { name: "Sign in to post a role" })).toBeVisible();
    // The posting form itself is never reachable without a verified company.
    await page.goto("/employers/post");
    await expect(page).toHaveURL(/\/employers$/);
  });

  test("a candidate account has to opt in before it can post", async ({ page }) => {
    await signIn(page, recruiter("optin"));
    await page.goto("/employers");
    await expect(page.getByRole("heading", { name: "Are you hiring?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue as an employer" })).toBeVisible();
  });

  test("an unverified employer cannot post yet", async ({ page }) => {
    await claimVellum(page, recruiter("unverified"));
    // Still waiting on us, so the form stays out of reach.
    await page.goto("/employers/post");
    await expect(page).toHaveURL(/\/employers$/);
    await expect(page.getByRole("heading", { name: /Verifying Vellum/ })).toBeVisible();
  });

  test("a posted role is private until an admin approves it", async ({ page, browser }) => {
    const email = recruiter("post");
    await claimVellum(page, email);

    // An admin verifies the claim.
    const admin = await browser.newContext({ httpCredentials: { username: ADMIN_USER, password: ADMIN_PASS } });
    const adminPage = await admin.newPage();
    await adminPage.goto("/admin/moderation");
    const claim = adminPage.locator("li", { hasText: "wants to post as Vellum" }).first();
    await claim.getByRole("button", { name: "Approve" }).click();
    await expect(claim.getByRole("status")).toContainText("Verified.");

    // The recruiter can now post. The role goes in for review, not live.
    const title = `E2E Employer Role ${RUN}`;
    await page.goto("/employers/post");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Salary from (per year)").fill("2500000");
    await page.getByLabel("Salary to (per year)").fill("3500000");
    await page.getByLabel("Location", { exact: true }).fill("Bengaluru");
    await page.getByLabel("Where candidates apply").fill("https://vellum.example.com/careers/e2e");
    await page.getByLabel("Skills").fill("Go, E2E");
    await page.getByLabel("About the role").fill("We are hiring an engineer for the E2E suite to click on.");
    await page.getByRole("button", { name: "Submit for review" }).click();

    await expect(page).toHaveURL(/\/employers\?submitted=1/);
    await expect(page.getByRole("status")).toContainText(/with us for review/i);
    await expect(page.getByText("In review")).toBeVisible();

    // Not searchable while it waits.
    await page.goto(`/jobs?q=${encodeURIComponent("E2E Employer Role")}`);
    await expect(page.getByRole("heading", { name: /^0 jobs/ })).toBeVisible();

    // Approving it publishes it.
    await adminPage.goto("/admin/moderation");
    const queued = adminPage.locator("li", { hasText: title }).first();
    await queued.getByRole("button", { name: "Approve" }).click();
    await expect(queued.getByRole("status")).toContainText("Published.");

    // Invalidation is stale-while-revalidate, so the first search after the
    // approval can still be served from the cache.
    await expect(async () => {
      await page.goto(`/jobs?q=${encodeURIComponent("E2E Employer Role")}`);
      await expect(page.getByRole("link", { name: title })).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    // And the employer can take it down again.
    await page.goto("/employers");
    const row = page.locator("article", { hasText: title }).first();
    await row.getByRole("button", { name: "Close" }).click();
    await row.getByRole("button", { name: "Confirm close" }).click();
    await expect(page.locator("article", { hasText: title }).getByText("Closed")).toBeVisible();

    await admin.close();
  });

  test("a rejected role comes back with the reason", async ({ page, browser }) => {
    const email = recruiter("reject");
    await claimVellum(page, email);

    const admin = await browser.newContext({ httpCredentials: { username: ADMIN_USER, password: ADMIN_PASS } });
    const adminPage = await admin.newPage();
    await adminPage.goto("/admin/moderation");
    const claim = adminPage.locator("li", { hasText: "wants to post as Vellum" }).first();
    await claim.getByRole("button", { name: "Approve" }).click();
    await expect(claim.getByRole("status")).toContainText("Verified.");

    const title = `E2E Rejected Role ${RUN}`;
    await page.goto("/employers/post");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Salary from (per year)").fill("1000000");
    await page.getByLabel("Salary to (per year)").fill("1500000");
    await page.getByLabel("Location", { exact: true }).fill("Pune");
    await page.getByLabel("Where candidates apply").fill("https://vellum.example.com/careers/e2e-2");
    await page.getByLabel("About the role").fill("A role that the admin is going to turn down in this test.");
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page).toHaveURL(/\/employers\?submitted=1/);

    await adminPage.goto("/admin/moderation");
    const queued = adminPage.locator("li", { hasText: title }).first();
    await queued.getByRole("button", { name: "Turn down" }).click();
    await queued.getByRole("textbox", { name: "Reason" }).fill("The band looks below market for this level.");
    await queued.getByRole("button", { name: "Turn down" }).click();
    await expect(queued.getByRole("status")).toContainText("Turned down.");

    await page.goto("/employers");
    const row = page.locator("article", { hasText: title }).first();
    await expect(row.getByText("Not published")).toBeVisible();
    await expect(row.getByText(/below market/)).toBeVisible();

    await admin.close();
  });
});
