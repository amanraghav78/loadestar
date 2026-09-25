import { expect, test, type Page } from "@playwright/test";
import { resumePdf, SAMPLE_RESUME } from "../resume-pdf";

/**
 * Google's consent screen can't be automated, so these sign in through the
 * test-only hook (see app/api/test/sign-in/route.ts), which is off unless
 * E2E_TEST_AUTH=1 and never available in production.
 */
const PASSWORD = "e2e-password-1234";

/**
 * A fresh candidate per test *and* per run: tests must not inherit saved roles
 * or a resume from each other, or from the last time the suite ran against this
 * database.
 */
const RUN = Date.now().toString(36);
const candidate = (label: string) => `e2e-${label}-${RUN}@example.test`;

async function signIn(page: Page, email: string, name = "Ada Tester") {
  const res = await page.request.post("/api/test/sign-in", { data: { email, name, password: PASSWORD } });
  expect(res.ok(), `test sign-in failed: ${res.status()}`).toBe(true);
}

async function signOut(page: Page) {
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
}

const savedCount = (page: Page) => page.getByRole("banner").getByRole("link", { name: /Saved/ });

test.describe("accounts", () => {
  test("the account page sends signed-out visitors to sign in", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  });

  test("the test-only sign-in hook is the only way in, and it is guarded", async ({ request }) => {
    // Rejected shapes never reach Better Auth.
    expect((await request.post("/api/test/sign-in", { data: { email: "nope" } })).status()).toBe(400);
  });

  test("signing in shows the account, and signing out hides it again", async ({ page }) => {
    const email = candidate("session");
    await signIn(page, email);
    await page.goto("/");
    await expect(page.getByRole("banner").getByRole("link", { name: /Ada/ })).toBeVisible();

    await page.goto("/account");
    await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    await signOut(page);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("roles saved before signing in follow you into the account, once", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("article").first();
    const title = (await card.getByRole("heading").textContent())!;
    await card.getByRole("button", { name: `Save ${title}` }).click();
    await expect(savedCount(page)).toContainText("1");

    const email = candidate("merge");
    await signIn(page, email);
    await page.goto("/saved");
    await expect(savedCount(page)).toContainText("1");
    await expect(page.getByRole("article").getByRole("heading")).toHaveText(title);

    // Signing in again must not duplicate the merge.
    await signOut(page);
    await signIn(page, email);
    await page.goto("/saved");
    await expect(savedCount(page)).toContainText("1");
    await expect(page.getByRole("article")).toHaveCount(1);
  });

  test("one candidate's saved roles never show up for the next one", async ({ page }) => {
    await signIn(page, candidate("leak-a"), "Ada Tester");
    await page.goto("/");
    const card = page.getByRole("article").first();
    const title = (await card.getByRole("heading").textContent())!;
    await card.getByRole("button", { name: `Save ${title}` }).click();
    await expect(savedCount(page)).toContainText("1");

    await signOut(page);
    await signIn(page, candidate("leak-b"), "Bo Tester");
    await page.goto("/saved");
    await expect(savedCount(page)).not.toContainText(/\d/);
    await expect(page.getByText("No saved jobs yet")).toBeVisible();
  });

  test("the profile keeps what you type and rejects what it should", async ({ page }) => {
    await signIn(page, candidate("profile"));
    await page.goto("/account");

    await page.getByLabel("Years of experience").fill("99");
    await page.getByLabel("LinkedIn").fill("https://example.com/not-linkedin");
    await page.getByRole("button", { name: /Save profile/ }).click();
    await expect(page.getByText("That looks too high")).toBeVisible();
    await expect(page.getByText("Enter a linkedin.com address")).toBeVisible();

    await page.getByLabel("Full name").fill("Ada Tester");
    await page.getByLabel("Years of experience").fill("6");
    await page.getByLabel("LinkedIn").fill("https://www.linkedin.com/in/ada");
    await page.getByLabel("City").fill("Bengaluru");
    await page.getByRole("button", { name: /Save profile/ }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("City")).toHaveValue("Bengaluru");
    await expect(page.getByLabel("Years of experience")).toHaveValue("6");
  });

  test("a resume upload only accepts a real PDF, and only its owner can fetch it", async ({ page, browser }) => {
    await signIn(page, candidate("resume"));
    await page.goto("/account");

    // Going through the button (rather than setting the hidden input directly)
    // guarantees React has hydrated: the chooser only opens from its handler.
    const choose = async (name: string, contents: string) => {
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.getByRole("button", { name: /(Upload|Replace) resume/ }).click(),
      ]);
      await chooser.setFiles({ name, mimeType: "application/pdf", buffer: Buffer.from(contents) });
    };

    await choose("resume.pdf", "not a pdf");
    await expect(page.getByText(/isn't a PDF/)).toBeVisible();

    await choose("Ada CV.pdf", "%PDF-1.7\n% test fixture\n");
    await expect(page.getByText("Ada CV.pdf")).toBeVisible();

    const download = await page.request.get("/api/resume");
    expect(download.status()).toBe(200);
    expect(download.headers()["content-type"]).toContain("application/pdf");
    expect(download.headers()["content-disposition"]).toContain("attachment");

    // A signed-out visitor gets nothing.
    const stranger = await browser.newContext();
    expect((await stranger.request.get("/api/resume")).status()).toBe(401);
    await stranger.close();

    await page.getByRole("button", { name: /Remove Ada CV.pdf/ }).click();
    await expect(page.getByText("No resume yet.")).toBeVisible();
  });

  test("a readable resume fills the blank profile fields, without saving anything", async ({ page }) => {
    await signIn(page, candidate("parse"));
    await page.goto("/account");

    // Typed by hand first: the resume must not overwrite this.
    await page.getByLabel("City").fill("Chennai");

    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: /(Upload|Replace) resume/ }).click(),
    ]);
    await chooser.setFiles({ name: "Priya CV.pdf", mimeType: "application/pdf", buffer: resumePdf(SAMPLE_RESUME) });

    await expect(page.getByText(/We filled \d+ fields from your resume/)).toBeVisible();
    await expect(page.getByLabel("Current title")).toHaveValue("Senior Data Engineer");
    await expect(page.getByLabel("Years of experience")).toHaveValue("9");
    await expect(page.getByLabel("Notice period")).toHaveValue("60");
    await expect(page.getByLabel("Current salary")).toHaveValue("38 L");
    await expect(page.getByLabel("Skills")).toHaveValue(/Python/);

    // Neither the city they typed nor the name Google gave us is overwritten.
    await expect(page.getByLabel("City")).toHaveValue("Chennai");
    await expect(page.getByLabel("Full name")).toHaveValue("Ada Tester");

    // Nothing is stored until they say so.
    await page.reload();
    await expect(page.getByLabel("Current title")).toHaveValue("");
    await expect(page.getByLabel("Years of experience")).toHaveValue("");
  });

  test("salary, notice period and skills survive a save", async ({ page }) => {
    await signIn(page, candidate("comp"));
    await page.goto("/account");

    await page.getByLabel("Full name").fill("Ada Tester");
    await page.getByLabel("Current salary").fill("18 LPA");
    await page.getByLabel("Expected salary").fill("2500000");
    await page.getByLabel("Notice period").selectOption("30");
    await page.getByLabel("Skills").fill("Kubernetes, Terraform, kubernetes");
    await page.getByRole("button", { name: /Save profile/ }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.reload();
    // Both spellings of pay come back the way pay is quoted.
    await expect(page.getByLabel("Current salary")).toHaveValue("18 L");
    await expect(page.getByLabel("Expected salary")).toHaveValue("25 L");
    await expect(page.getByLabel("Notice period")).toHaveValue("30");
    // The duplicate is dropped, case-insensitively.
    await expect(page.getByLabel("Skills")).toHaveValue("Kubernetes, Terraform");
  });

  test("matches rank open roles against the profile, and explain why", async ({ page }) => {
    await signIn(page, candidate("matches"));

    await page.goto("/account/matches");
    await expect(page.getByText("Add your skills to see matches")).toBeVisible();

    await page.goto("/account");
    await page.getByLabel("Full name").fill("Ada Tester");
    await page.getByLabel("Years of experience").fill("8");
    await page.getByLabel("Skills").fill("Kubernetes, Terraform");
    await page.getByRole("button", { name: /Save profile/ }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.goto("/account/matches");
    await expect(page.getByRole("article").first()).toBeVisible();
    await expect(page.getByText("Matching on Kubernetes, Terraform")).toBeVisible();
    // Each card says why it is here, in the candidate's own skills.
    await expect(page.getByText("Kubernetes and Terraform match").first()).toBeVisible();
  });

  test("applying while signed in lists the role under Applied", async ({ page }) => {
    await signIn(page, candidate("applied"));
    await page.goto("/jobs?q=ingest");
    await page.getByRole("article").first().getByRole("link").first().click();
    await page.waitForURL(/\/jobs\/.+/);
    const title = (await page.getByRole("heading", { level: 1 }).textContent())!;
    const href = (await page.getByRole("link", { name: /^Apply now/ }).getAttribute("href"))!;
    await page.request.get(href, { maxRedirects: 0 });

    // The write happens after the redirect goes out, so give it a reload or two.
    await expect(async () => {
      await page.goto("/account/applications");
      await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    }).toPass({ timeout: 10_000 });
  });

  test("deleting the account removes the profile and signs you out", async ({ page }) => {
    const email = candidate("delete");
    await signIn(page, email, "Bo Tester");
    await page.goto("/account");
    await page.getByLabel("Full name").fill("Bo Tester");
    await page.getByLabel("City").fill("Pune");
    await page.getByRole("button", { name: /Save profile/ }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.getByRole("button", { name: "Delete account" }).click();
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await expect(page).toHaveURL(/\/\?deleted=1/);

    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in/);

    // A fresh account of the same name starts empty.
    await signIn(page, email, "Bo Tester");
    await page.goto("/account");
    await expect(page.getByLabel("City")).toHaveValue("");
  });

  test("the resume builder writes a real PDF, and reviews it as you type", async ({ page }) => {
    await signIn(page, candidate("builder"));

    // The header of the resume is the profile: it is not typed twice.
    await page.goto("/account");
    await page.getByLabel("Full name").fill("Ada Tester");
    await page.getByLabel("City").fill("Bengaluru");
    await page.getByLabel("Phone").fill("+91 98765 43210");
    await page.getByLabel("LinkedIn").fill("https://www.linkedin.com/in/ada");
    await page.getByRole("button", { name: /Save profile/ }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.goto("/account/resume");
    // Nothing written yet, and the review says so rather than flattering them.
    await expect(page.getByText("Not ready yet")).toBeVisible();

    await page.getByLabel("Role you want").fill("Senior Backend Engineer");
    await page
      .getByLabel("Summary")
      .fill(
        "Backend engineer with six years on payments systems in Python and Go, most recently at Razorpay. " +
          "Looking for a senior role on a platform team in Bengaluru.",
      );
    await page.getByLabel("Skills").fill("Python, Django, PostgreSQL, AWS, Docker, Kubernetes");

    await page.getByRole("button", { name: "Add a role" }).click();
    await page.getByLabel("Title").fill("Backend Engineer");
    await page.getByLabel("Employer").fill("Razorpay");
    await page.getByLabel("Location").fill("Bengaluru");
    await page.getByLabel("From").fill("2020-03");
    await page.getByLabel("I still work here").check();
    await page
      .getByLabel("What you did")
      .fill(
        [
          "Cut checkout latency 40% by rewriting the settlement job in Go",
          "Led four engineers through the UPI migration",
        ].join("\n"),
      );

    await page.getByRole("button", { name: "Add a qualification" }).click();
    await page.getByLabel("Degree").fill("B.Tech, Computer Science");
    await page.getByLabel("Institution").fill("NIT Warangal");

    // The preview is the document, not a description of it.
    const preview = page.getByLabel("Resume preview");
    await expect(preview).toContainText("Ada Tester");
    await expect(preview).toContainText("Senior Backend Engineer");
    await expect(preview).toContainText("Backend Engineer · Razorpay");
    await expect(preview).toContainText("Bengaluru · Mar 2020 – Present");
    await expect(preview).toContainText("Cut checkout latency 40%");

    // The review moves as they write.
    await expect(page.getByText("Ready to send")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download PDF" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("Ada Tester - Resume.pdf");

    await page.getByRole("button", { name: "Save resume" }).click();
    await expect(page.getByText("Resume saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Role you want")).toHaveValue("Senior Backend Engineer");
    await expect(page.getByLabel("Employer")).toHaveValue("Razorpay");

    // Kept on file, it becomes the resume the account holds.
    await page.getByRole("button", { name: "Keep as my resume on file" }).click();
    await expect(page.getByText(/the resume on your account/)).toBeVisible();
    const file = await page.request.get("/api/resume");
    expect(file.status()).toBe(200);
    expect(file.headers()["content-type"]).toContain("application/pdf");
  });

  test("the resume builder sends signed-out visitors to sign in", async ({ page }) => {
    await page.goto("/account/resume");
    await expect(page).toHaveURL(/\/sign-in\?next=/);
  });
});
