import { expect, test, type Page } from "@playwright/test";

/**
 * Company reviews: written by a signed-in candidate, published only once an
 * admin has read them. The rating on the company page must never move before
 * that, which is the point of the queue.
 */

const ADMIN_USER = process.env.ADMIN_USER ?? "admin";
const ADMIN_PASS = process.env.ADMIN_PASS ?? "local-dev-password";
const PASSWORD = "e2e-password-1234";

const RUN = Date.now().toString(36);
const reviewer = (label: string) => `e2e-rev-${label}-${RUN}@example.test`;

async function signIn(page: Page, email: string, name = "Ravi Reviewer") {
  const res = await page.request.post("/api/test/sign-in", { data: { email, name, password: PASSWORD } });
  expect(res.ok(), `test sign-in failed: ${res.status()}`).toBe(true);
}

async function writeReview(page: Page, title: string) {
  await page.goto("/companies/quillon");
  // The radio is visually hidden behind its star, so click the label a person
  // would click rather than the input itself.
  await page.locator('label[title="4 out of 5"]').click();
  await expect(page.getByRole("radio", { name: "4 out of 5" })).toBeChecked();
  await page.getByLabel("Sum it up").fill(title);
  await page.getByLabel("What works").fill("Thoughtful code review and hours that genuinely flex around family.");
  // The label is typeset with a curly apostrophe, so match on the stem.
  await page.getByLabel(/What doesn/).fill("Planning can wander, and the roadmap moves more than anyone would like.");
  await page.getByLabel("Your role there").fill("Backend engineer");
  await page.getByRole("button", { name: /Submit review|Replace my review/ }).click();
}

test.describe("company reviews", () => {
  test("signed-out visitors are asked to sign in", async ({ page }) => {
    await page.goto("/companies/quillon");
    await expect(page.getByRole("heading", { name: "Worked here?" })).toBeVisible();
  });

  test("a review waits for approval, then appears with its rating", async ({ page, browser }) => {
    const title = `E2E review ${RUN}`;
    await signIn(page, reviewer("flow"));
    await writeReview(page, title);
    await expect(page.getByRole("status")).toContainText(/before it appears/i);

    // Nothing public yet.
    await page.goto("/companies/quillon");
    await expect(page.getByText(title)).toBeHidden();
    await expect(page.getByRole("heading", { name: "Your review is with us" })).toBeVisible();

    const admin = await browser.newContext({ httpCredentials: { username: ADMIN_USER, password: ADMIN_PASS } });
    const adminPage = await admin.newPage();
    await adminPage.goto("/admin/moderation");
    const queued = adminPage.locator("li", { hasText: title }).first();
    await queued.getByRole("button", { name: "Approve" }).click();
    await expect(queued.getByRole("status")).toContainText("Published.");

    // Published, and counted in the company's rating. Tag invalidation is
    // stale-while-revalidate (lib/revalidate.ts), so the first read after an
    // approval can still be the cached one — reload until it lands.
    await expect(async () => {
      await page.goto("/companies/quillon");
      await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.getByLabel("4 out of 5").first()).toBeVisible();

    await admin.close();
  });

  test("a review that is turned down tells its author why", async ({ page, browser }) => {
    const title = `E2E rejected review ${RUN}`;
    await signIn(page, reviewer("rejected"));
    await writeReview(page, title);

    const admin = await browser.newContext({ httpCredentials: { username: ADMIN_USER, password: ADMIN_PASS } });
    const adminPage = await admin.newPage();
    await adminPage.goto("/admin/moderation");
    const queued = adminPage.locator("li", { hasText: title }).first();
    await queued.getByRole("button", { name: "Turn down" }).click();
    await queued.getByRole("textbox", { name: "Reason" }).fill("It names an individual colleague.");
    await queued.getByRole("button", { name: "Turn down" }).click();
    await expect(queued.getByRole("status")).toContainText("Turned down.");

    await page.goto("/companies/quillon");
    await expect(page.getByRole("heading", { name: /wasn't published/ })).toBeVisible();
    await expect(page.getByText(/names an individual colleague/)).toBeVisible();

    await admin.close();
  });
});
