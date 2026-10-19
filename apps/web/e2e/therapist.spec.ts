import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";
import { PASSWORD, closeCore, core, currentUserId, newEmail, outbox, signUpQuietly } from "./support";

/**
 * F4, end to end, on the production build: a person invites their own
 * therapist; a practice invites a patient and receives a report; ending a
 * link refuses the practice at once; and every new route belongs to its
 * owner. No assistant is set up: reports are prepared by sintr alone, so
 * no model (not even the offline one) is part of these flows.
 */

const sql = postgres(process.env.SINTR_E2E_DATABASE_URL!, { max: 1, onnotice: () => undefined });
const DAY = 24 * 60 * 60 * 1000;
const THOUGHT = "I will never catch up with all of this";
const NOTE = "slept badly, woke at four";

test.afterAll(async () => {
  await sql.end();
  await closeCore();
});

async function scopeOf(page: Page) {
  return core().repositories.forUser(await currentUserId(page));
}

/**
 * A few days of diary, written through the core, never shared as such, and
 * a session two days ahead, so the report covers the seven days before it
 * whatever day the suite runs.
 */
async function writeDiary(page: Page) {
  const scope = await scopeOf(page);
  const now = Date.now();
  await scope.therapySettings.update({
    sessionDay: new Date(now + 2 * DAY).getUTCDay(),
    sessionTime: "18:00",
  });
  await scope.entries.create({
    occurredAt: new Date(now - 2 * DAY),
    title: "The planning meeting",
    situation: "three new requests arrived for the same week",
    thoughts: [THOUGHT],
    emotions: [{ name: "anxiety", intensity: 80 }],
  });
  // Outside the report's period: in the diary, never in what is shared.
  await scope.entries.create({
    occurredAt: new Date(now - 20 * DAY),
    situation: "a private entry, not in any report",
  });
  for (const [days, mood, note] of [
    [3, 2, NOTE],
    [1, 4, null],
  ] as const) {
    await scope.checkins.create({ occurredAt: new Date(now - days * DAY), mood, anxiety: 5 - mood, note });
  }
  return scope;
}

async function account(browser: Browser, label: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signUpQuietly(page, newEmail(label));
  return { context, page };
}

async function openPractice(page: Page, name: string) {
  await page.goto("/practice");
  await expect(page.getByRole("heading", { level: 1, name: "Your practice" })).toBeVisible();
  await page.getByLabel("Your name, as the people you see know it").fill(name);
  await page.getByLabel("Registration you want to show").fill("CRP 06/123456");
  await page.getByRole("button", { name: "Open my practice" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

/** Prepare this week's report (sintr alone, no assistant) and approve it; returns its id. */
async function prepareAndApprove(
  page: Page,
  approve: string | RegExp = "Approve this report",
): Promise<string> {
  await page.goto("/reports");
  await page.getByRole("button", { name: /^Prepare (it now|this week's report)$/ }).click();
  await expect(page).toHaveURL(/\/reports\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByRole("button", { name: approve }).click();
  await expect(page.getByRole("status").getByText(/^Approved by you/)).toBeVisible({ timeout: 60_000 });
  return id;
}

test.describe("a person gives their own therapist access", () => {
  test.slow();

  test("invite, the therapist accepts from a practice, the person confirms, shares, and stops", async ({
    page,
    browser,
  }) => {
    await signUpQuietly(page, newEmail("patient"));
    const person = await writeDiary(page);

    // The person invites their therapist: a code and a link, nothing shared yet.
    await page.goto("/sharing");
    await expect(page.getByText("Right now nobody can see anything you write.")).toBeVisible();
    await page.getByRole("link", { name: "Invite your therapist" }).click();
    await page.getByLabel("How they will see you").fill("Ana");
    await page.getByRole("button", { name: "Make an invite for my therapist" }).click();
    const code = (await page.locator("code").first().textContent())!.trim();
    expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    const link = await page.locator("code").nth(1).textContent();
    expect(link).toContain(`/join/${code}`);

    // The therapist opens it, opens a practice on the way, and accepts.
    const therapist = await account(browser, "therapist");
    const t = therapist.page;
    await t.goto(`/join/${code}`);
    await expect(t.getByRole("heading", { level: 1 })).toContainText("Ana");
    await t.getByLabel("Your name, as the people you see know it").fill("Dr. Bruno Lima");
    await t.getByRole("button", { name: "Open my practice and accept" }).click();
    await expect(t).toHaveURL(/\/practice$/);
    await expect(t.getByText("Waiting for them to confirm.")).toBeVisible();

    // The person confirms that it is their therapist, with consent.
    await page.goto("/sharing");
    await expect(
      page.getByText("Dr. Bruno Lima accepted your invite. Confirm it to start sharing."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirm, it is my therapist" }).click();
    await expect(page.getByText("Tick the box to give your consent, or decline.")).toBeVisible();
    await page.getByLabel(/I agree to share the reports I approve with/).check();
    await page.getByRole("button", { name: "Confirm, it is my therapist" }).click();
    await expect(
      page.getByText("Your therapist can read the reports you approve; nothing else."),
    ).toBeVisible();
    await expect(page.getByText("They see you as Ana.", { exact: false })).toBeVisible();

    // A report is shared only with the person's explicit yes, after approval.
    const reportId = await prepareAndApprove(page);
    const share = page.getByRole("button", { name: "Share with Dr. Bruno Lima" });
    await expect(share).toBeDisabled();
    await page
      .getByLabel(/I approve sharing this report, exactly as in the PDF below, with Dr. Bruno Lima/)
      .check();
    await share.click();
    await expect(page.getByText(/Shared with Dr. Bruno Lima on .*Not opened yet\./)).toBeVisible();
    // Final once shared.
    expect((await page.request.put(`/api/reports/${reportId}`, { data: { content: {} } })).status()).toBe(
      409,
    );
    await expect(page.getByRole("link", { name: "Change the words" })).toHaveCount(0);

    // The therapist reads it in place and downloads its PDF.
    await t.goto("/practice");
    const row = t.getByRole("link", { name: /Ana/ }).first();
    await expect(row.getByText("New")).toBeVisible();
    await row.click();
    const paper = t.getByRole("article", { name: "The report" });
    await expect(paper.locator("q", { hasText: THOUGHT }).first()).toBeVisible();
    expect(await paper.textContent()).not.toContain("a private entry, not in any report");
    const shareId = new URL(t.url()).searchParams.get("report")!;
    const pdf = await t.request.get(`/api/practice/reports/${shareId}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect(pdf.headers()["content-disposition"]).toMatch(/^attachment; filename="sintr-report-.+\.pdf"$/);
    expect((await pdf.body()).equals((await person.reports.readPdf(reportId))!)).toBe(true);

    // The person sees that it was opened; reading is in both audit logs.
    await page.goto("/sharing");
    await expect(page.getByText(/They opened it on/)).toBeVisible();
    const professional = await scopeOf(t);
    for (const scope of [person, professional]) {
      const actions = (await scope.auditLog.list()).map((e) => e.action);
      expect(actions).toEqual(expect.arrayContaining(["share.created", "share.read", "share.downloaded"]));
    }
    const consents = (await person.consents.list()).map((c) => c.purpose);
    expect(consents).toEqual(expect.arrayContaining(["practice_link", "report_share"]));

    // Stopping is one action, and the practice is refused at once.
    await page.getByRole("button", { name: "Stop sharing with Dr. Bruno Lima" }).click();
    await page.getByRole("button", { name: "Yes, stop sharing" }).click();
    await expect(page.getByText("Right now nobody can see anything you write.")).toBeVisible();
    expect((await t.request.get(`/api/practice/reports/${shareId}/pdf`)).status()).toBe(404);
    await t.goto(`/practice?report=${shareId}`);
    await expect(t.getByText("That report is not here any more")).toBeVisible();
    await expect(t.getByRole("article", { name: "The report" })).toHaveCount(0);
    await expect(t.getByText("A patient ended their link with your practice.")).toBeVisible();
    await expect(t.getByText("No patients yet.", { exact: false })).toBeVisible();
    const [row2] = await sql<{ status: string; key: Buffer | null; n: number }[]>`
      select l.status, l.wrapped_key as key, (select count(*)::int from shared_reports s where s.link_id = l.id) as n
      from links l where l.user_id = ${person.userId}`;
    expect(row2).toMatchObject({ status: "ended", key: null, n: 0 });
    await therapist.context.close();
  });
});

test.describe("a practice invites a patient and receives a report", () => {
  test.slow();

  test("from the invite to the report read in place, and a symmetric disconnect", async ({
    page,
    browser,
  }) => {
    await signUpQuietly(page, newEmail("practice"));
    await openPractice(page, "Dr. Marina Costa");
    await expect(page.getByText("0 active patients. Unlimited seats.")).toBeVisible();

    await page.goto("/practice/invite");
    await page.getByLabel("Who it is for").fill("Ana, Tuesdays");
    await page.getByRole("button", { name: "Make an invite" }).click();
    await expect(page.getByText("For Ana, Tuesdays")).toBeVisible();
    const code = (await page.locator("code").first().textContent())!.trim();
    await page.goto("/practice");
    await expect(page.getByText("Invites waiting")).toBeVisible();
    await expect(page.getByText("Ana, Tuesdays")).toBeVisible();

    // The person opens the link without an account, sees who invites, and creates a diary.
    const visitor = await browser.newContext();
    const v = await visitor.newPage();
    await v.goto(`/join/${code.toLowerCase()}`);
    await expect(v.getByRole("heading", { level: 1 })).toContainText("Dr. Marina Costa");
    await expect(v.getByText("CRP 06/123456")).toBeVisible();
    await expect(v.getByLabel("How they will see you")).toHaveCount(0);
    await v.getByRole("link", { name: "Create your diary" }).click();
    await expect(v).toHaveURL(/\/sign-up\?next=/);
    const email = newEmail("ana");
    await v.getByLabel("Email").fill(email);
    await v.getByLabel("Password").fill(PASSWORD);
    await v.getByRole("checkbox").check();
    await v.getByRole("button", { name: "Create your diary" }).click();
    await expect(v).toHaveURL(new RegExp(`/join/${code.toLowerCase()}$`));

    // The person's yes: a name, how reports go, and the consent.
    await v.getByLabel("How they will see you").fill("Ana");
    await v.getByRole("radio", { name: "Send what I approve" }).check({ force: true });
    await v.getByRole("button", { name: "Accept and link" }).click();
    await expect(v.getByText("Tick the box to give your consent, or leave it for now.")).toBeVisible();
    await v.getByLabel(/I agree to share the reports I approve with Dr. Marina Costa/).check();
    await v.getByRole("button", { name: "Accept and link" }).click();
    await expect(v).toHaveURL(/\/sharing$/);
    await expect(v.getByText("Every report you approve goes to them as you approve it.")).toBeVisible();
    // The invite was used.
    await v.goto(`/join/${code}`);
    await expect(v.getByText("This invite does not work any more.")).toBeVisible();

    // Approving shares it, because the person chose so, and the button says it.
    const person = await writeDiary(v);
    await prepareAndApprove(v, "Approve and share with Dr. Marina Costa");
    await expect(v.getByText(/Shared with Dr. Marina Costa on/)).toBeVisible();

    await page.goto("/practice");
    await expect(page.getByText("1 active patient. Unlimited seats.")).toBeVisible();
    await expect(page.getByText("Ana linked with your practice.", { exact: false })).toBeVisible();
    await page.getByRole("link", { name: /Ana/ }).first().click();
    await expect(page.getByRole("article", { name: "The report" }).getByText(NOTE)).toBeVisible();

    // No cross-patient numbers on the dashboard itself: counts of patients and seats only.
    await page.goto("/practice");
    const dashboard = await page.locator("main").textContent();
    expect(dashboard).not.toMatch(/average|trend|score|mood/iu);

    // The practice disconnects: the same end, and the person is told.
    await page.getByRole("button", { name: "Disconnect Ana" }).click();
    await page.getByRole("button", { name: "Yes, disconnect" }).click();
    await expect(page.getByText("No patients yet.", { exact: false })).toBeVisible();
    await expect(page.getByText("0 active patients. Unlimited seats.")).toBeVisible();
    await v.goto("/sharing");
    await expect(
      v.getByText("Dr. Marina Costa ended the link. They no longer see your reports."),
    ).toBeVisible();
    await expect(v.getByText("Right now nobody can see anything you write.")).toBeVisible();
    expect(await person.sharing.links()).toEqual([]);
    // Nothing was emailed on the way: the worker sends the practice notice, and only on opt-in.
    expect(outbox(email).filter((m) => m.subject.includes("shared"))).toEqual([]);
    await visitor.close();
  });
});

test.describe("the practice routes are scoped to their owner", () => {
  test("another practice, another person and a stranger reach none of it", async ({ page, browser }) => {
    // A linked person shares an approved report with practice A.
    await signUpQuietly(page, newEmail("owner-practice"));
    await openPractice(page, "Dr. A");
    const practiceA = await scopeOf(page);
    const person = await account(browser, "linked");
    const personScope = await writeDiary(person.page);
    const invite = await practiceA.practice.createInvite();
    const link = await personScope.sharing.acceptInvite(invite.code, { consent: true, personName: "Linked" });
    const reportId = await prepareAndApprove(person.page);
    const draft = await personScope.reports.createDraft({
      periodStart: new Date(Date.now() - 30 * DAY),
      periodEnd: new Date(Date.now() - 29 * DAY),
      content: "{}",
    });
    await person.page.goto(`/reports/${reportId}`);
    await person.page.getByLabel(/I approve sharing this report/).check();
    await person.page.getByRole("button", { name: "Share with Dr. A" }).click();
    await expect(person.page.getByText(/Shared with Dr. A on/)).toBeVisible();
    const [received] = await practiceA.practice.reports();
    expect(received).toBeDefined();

    // Another practice, through the app: nothing of it.
    const other = await account(browser, "other-practice");
    await openPractice(other.page, "Dr. B");
    await other.page.goto(`/practice?report=${received!.id}`);
    await expect(other.page.getByText("That report is not here any more")).toBeVisible();
    await expect(other.page.getByRole("article", { name: "The report" })).toHaveCount(0);
    await expect(other.page.getByText("Linked", { exact: true })).toHaveCount(0);
    expect((await other.page.request.get(`/api/practice/reports/${received!.id}/pdf`)).status()).toBe(404);
    // Not the person's report, nor their draft, through the person's own routes either.
    expect((await other.page.request.get(`/api/reports/${reportId}/pdf`)).status()).toBe(404);
    expect((await other.page.request.get(`/api/reports/${draft.id}/pdf`)).status()).toBe(404);
    expect(
      (
        await other.page.request.post(`/api/reports/${reportId}`, {
          data: { action: "share", linkId: link.id, confirmed: true },
        })
      ).status(),
    ).toBe(404);

    // Another person cannot share their own report through the person's link.
    const stranger = await account(browser, "stranger");
    const strangerScope = await writeDiary(stranger.page);
    const own = await prepareAndApprove(stranger.page);
    expect(
      (
        await stranger.page.request.post(`/api/reports/${own}`, {
          data: { action: "share", linkId: link.id, confirmed: true },
        })
      ).status(),
    ).toBe(404);
    await stranger.page.goto("/sharing");
    await expect(stranger.page.getByText("Right now nobody can see anything you write.")).toBeVisible();
    expect(await strangerScope.sharing.links()).toEqual([]);
    // An account without a practice gets the page to open one, not anyone else's.
    await stranger.page.goto("/practice");
    await expect(stranger.page.getByRole("button", { name: "Open my practice" })).toBeVisible();

    // A draft never travels, even asked for directly.
    expect(
      (
        await person.page.request.post(`/api/reports/${draft.id}`, {
          data: { action: "share", linkId: link.id, confirmed: true },
        })
      ).status(),
    ).toBe(409);
    expect((await practiceA.practice.reports()).map((r) => r.reportId)).toEqual([reportId]);

    // An unknown code tells nothing; signed out, the routes are closed.
    await stranger.page.goto(`/join/${randomUUID().slice(0, 14)}`);
    await expect(stranger.page.getByText("This invite does not work any more.")).toBeVisible();
    const anonymous = await browser.newContext();
    const a = await anonymous.newPage();
    for (const path of [
      "/practice",
      "/practice/invite",
      "/practice/details",
      "/sharing",
      "/sharing/invite",
    ]) {
      const response = await a.request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
    }
    expect((await a.request.get(`/api/practice/reports/${received!.id}/pdf`)).status()).toBe(401);
    // A share asked for from another origin is refused.
    expect(
      (
        await person.page.request.post(`/api/reports/${reportId}`, {
          headers: { origin: "https://elsewhere.example" },
          data: { action: "share", linkId: link.id, confirmed: true },
        })
      ).status(),
    ).toBe(403);
    for (const context of [anonymous, other.context, stranger.context, person.context]) await context.close();
  });
});
