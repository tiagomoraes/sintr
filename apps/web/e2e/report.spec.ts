import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { closeCore, core, currentUserId, newEmail, outbox, setUpAssistant, signUpQuietly } from "./support";

/**
 * F2, end to end: the production build, the offline rehearsal model and the
 * outbox email transport. Configure therapy, prepare the report, read it,
 * change it, approve it and send it, and check that every new route
 * belongs to its owner.
 */

const sql = postgres(process.env.SINTR_E2E_DATABASE_URL!, { max: 1, onnotice: () => undefined });
const THOUGHT = "I will never catch up with all of this";
const NOTE = "slept badly, woke at four";
const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

test.afterAll(async () => {
  await sql.end();
  await closeCore();
});

async function scopeOf(page: Page) {
  return core().repositories.forUser(await currentUserId(page));
}

/** A few days of diary, written through the core: two entries and three check-ins. */
async function writeDiary(page: Page) {
  const scope = await scopeOf(page);
  const now = Date.now();
  await scope.entries.create({
    occurredAt: new Date(now - 2 * DAY),
    title: "The planning meeting",
    situation: "three new requests arrived for the same week",
    thoughts: [THOUGHT],
    emotions: [{ name: "anxiety", intensity: 80 }],
    behavior: "said yes to all three",
  });
  await scope.entries.create({
    occurredAt: new Date(now - DAY),
    title: "A walk at lunch",
    situation: "walked twenty minutes without the phone",
    thoughts: ["first pause in weeks"],
    emotions: [{ name: "relief", intensity: 60 }],
  });
  for (const [days, mood, note] of [
    [3, 2, NOTE],
    [2, 2, null],
    [1, 4, "a lighter day"],
  ] as const) {
    await scope.checkins.create({
      occurredAt: new Date(now - days * DAY),
      mood,
      anxiety: 5 - mood,
      sleepHours: 6.5,
      note,
    });
  }
  await scope.therapyNotes.create({ kind: "to_bring", body: "The planning meeting on Tuesday." });
  return scope;
}

async function configureTherapy(page: Page, therapistEmail: string) {
  const sessionDay = WEEKDAYS[new Date(Date.now() + 2 * DAY).getUTCDay()]!;
  await page.goto("/therapy");
  // Therapy opens on sentences; each part opens to change it.
  await page.getByText("Your sessions", { exact: true }).click();
  await page.getByRole("radio", { name: `${sessionDay}s`, exact: true }).check();
  await page.getByLabel("Time", { exact: true }).fill("18:00");
  await page.getByText("Your therapist", { exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Dr. Example");
  await page.getByLabel("Email", { exact: true }).fill(therapistEmail);
  await page.getByRole("radio", { name: "Send it to my therapist" }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/The next report will be prepared on/)).toBeVisible();
  await expect(page.getByText(`${sessionDay}s at 18:00, in UTC time.`)).toBeVisible();
  await expect(page.getByText(`Dr. Example, at ${therapistEmail}.`, { exact: false })).toBeVisible();
  await expect(page.getByText("Every report waits for your approval.", { exact: false })).toBeVisible();
}

async function prepareReport(page: Page): Promise<string> {
  await page.goto("/reports");
  // "Prepare it now" with a session set, "Prepare this week's report" without one.
  await page.getByRole("button", { name: /^Prepare (it now|this week's report)$/ }).click();
  await expect(page).toHaveURL(/\/reports\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

test.describe("the weekly report", () => {
  // Three PDFs are printed on the way (the preview, the approved one, the sent one).
  test.slow();

  test("configure therapy, prepare, review, edit, approve and send it with the person's yes", async ({
    page,
  }) => {
    const therapist = `therapist-${randomUUID()}@example.test`;
    await signUpQuietly(page, newEmail("report"));
    await setUpAssistant(page);
    const scope = await writeDiary(page);

    // The therapy settings refuse a send without an address.
    await page.goto("/therapy");
    await page.getByText("Your therapist", { exact: true }).click();
    await page.getByRole("radio", { name: "Send it to my therapist" }).check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("To send the report, sintr needs your therapist's email.")).toBeVisible();
    await configureTherapy(page, therapist);
    expect(await scope.therapySettings.get()).toMatchObject({
      therapistName: "Dr. Example",
      therapistContact: therapist,
      sessionTime: "18:00",
      reportLeadMinutes: 60,
      deliveryChannel: "email",
      requireApproval: true,
    });

    // Prepare it now: a draft, read as a page, not as Markdown.
    const id = await prepareReport(page);
    await expect(page.getByRole("status").getByText("Draft, waiting for you")).toBeVisible();
    const paper = page.getByRole("article", { name: "The report" });
    await expect(paper.getByRole("heading", { name: "How the week went" })).toBeVisible();
    await expect(paper.getByRole("heading", { name: "For the session" })).toBeVisible();
    await expect(paper.getByText("The planning meeting on Tuesday.")).toBeVisible();
    await expect(paper.getByRole("heading", { name: "Moments that stood out" })).toBeVisible();
    // The person's words, highlighted because they are in the diary word for word.
    await expect(paper.locator("q", { hasText: THOUGHT }).first()).toBeVisible();
    await expect(paper.locator("q", { hasText: NOTE })).toBeVisible();
    expect(await paper.textContent()).not.toContain("##");

    // The PDF preview: a real PDF, marked as a draft.
    await expect(page.getByTitle("PDF preview of the report")).toBeVisible();
    const preview = await page.request.get(`/api/reports/${id}/pdf`);
    expect(preview.status()).toBe(200);
    expect(preview.headers()["content-type"]).toBe("application/pdf");
    expect(preview.headers()["x-frame-options"]).toBe("SAMEORIGIN");
    expect((await preview.body()).subarray(0, 5).toString()).toBe("%PDF-");

    // Change the words: the draft keeps what it said before.
    await page.getByRole("link", { name: "Change the words" }).click();
    const week = page.getByLabel("How the week went");
    const drafted = await week.inputValue();
    await week.fill(`${drafted} The walk on the last day was the best part.`);
    await page.getByRole("button", { name: "Save the changes" }).click();
    await expect(page).toHaveURL(new RegExp(`/reports/${id}$`));
    await expect(paper.getByText("The walk on the last day was the best part.")).toBeVisible();
    await expect(page.getByText("You changed how the week went.")).toBeVisible();
    const [revision] = await scope.reports.revisions(id);
    expect(revision).toMatchObject({ kind: "edited", sections: ["week"] });

    // Approve: the final PDF is printed and kept; nothing is sent yet.
    await page.getByRole("button", { name: "Approve this report" }).click();
    await expect(page.getByRole("status").getByText("Approved by you, not sent")).toBeVisible();
    expect(outbox(therapist)).toEqual([]);
    const approvedPdf = await scope.reports.readPdf(id);
    expect(approvedPdf?.subarray(0, 5).toString()).toBe("%PDF-");

    // Send: a second, explicit yes that names the address.
    const send = page.getByRole("button", { name: "Approve and send" });
    await expect(send).toBeDisabled();
    await page.getByLabel(/I approve sending this report/).check();
    await send.click();
    await expect(page.getByRole("status").getByText(`Sent with your approval to ${therapist}`)).toBeVisible();

    const [message] = outbox(therapist);
    expect(message!.subject).toContain("Weekly report");
    expect(message!.text).not.toContain(THOUGHT);
    expect(message!.attachments).toHaveLength(1);
    const attached = Buffer.from(message!.attachments[0]!.content, "base64");
    expect(attached.equals(approvedPdf!)).toBe(true);

    const report = await scope.reports.get(id);
    expect(report).toMatchObject({ status: "sent", recipient: therapist });
    const consents = (await scope.consents.list()).filter((c) => c.purpose === "report_send");
    expect(consents).toEqual([
      expect.objectContaining({ reportId: id, recipient: therapist, granted: true }),
    ]);
    const actions = (await scope.auditLog.list()).map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining(["report.prepared", "report.edited", "report.reviewed", "report.sent"]),
    );
    // Sealed at rest: the dump of the row shows neither the words nor the recipient.
    const [row] = await sql<{ dump: string }[]>`select r::text as dump from reports r where id = ${id}`;
    expect(row!.dump).not.toContain(THOUGHT);
    expect(row!.dump).not.toContain(therapist);

    // A sent report is final, and its PDF stays available.
    await page.reload();
    await expect(page.getByRole("button", { name: "Approve and send" })).toHaveCount(0);
    expect((await page.request.put(`/api/reports/${id}`, { data: { content: {} } })).status()).toBe(409);
    expect((await (await page.request.get(`/api/reports/${id}/pdf`)).body()).equals(approvedPdf!)).toBe(true);
    await page.goto("/reports");
    await expect(page.getByText(`Sent to ${therapist}`)).toBeVisible();
  });

  test("keeps the report for the person when they choose so, and never sends it", async ({ page }) => {
    await signUpQuietly(page, newEmail("keep"));
    const scope = await writeDiary(page);
    // No assistant: sintr prepares what it can alone.
    const id = await prepareReport(page);
    await expect(
      page.getByText("There is no assistant set up, so sintr prepared what it can on its own"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Approve this report" }).click();
    await expect(page.getByText("You chose to keep reports for yourself.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve and send" })).toHaveCount(0);
    const refused = await page.request.post(`/api/reports/${id}`, {
      data: { action: "send", recipient: "someone@example.test", confirmed: true },
    });
    expect(refused.status()).toBe(409);
    expect((await scope.reports.get(id))?.status).toBe("reviewed");
  });
});

test.describe("the report routes are scoped to their owner", () => {
  test("another person can open, print, change, approve and send none of it", async ({ page, browser }) => {
    await signUpQuietly(page, newEmail("alice"));
    await setUpAssistant(page);
    await writeDiary(page);
    const id = await prepareReport(page);
    const alice = await scopeOf(page);

    const bobContext = await browser.newContext();
    const bob = await bobContext.newPage();
    await signUpQuietly(bob, newEmail("bob"));
    for (const path of [`/reports/${id}`, `/reports/${id}/edit`]) {
      const response = await bob.goto(path);
      expect(response?.status(), path).toBe(404);
    }
    expect((await bob.request.get(`/api/reports/${id}/pdf`)).status()).toBe(404);
    for (const body of [
      { action: "approve" },
      { action: "prepare_again" },
      { action: "send", recipient: "x@example.test", confirmed: true },
    ]) {
      expect((await bob.request.post(`/api/reports/${id}`, { data: body })).status(), body.action).toBe(404);
    }
    expect((await bob.request.put(`/api/reports/${id}`, { data: { content: {} } })).status()).toBe(404);
    await bob.goto("/reports");
    await expect(bob.getByText("No reports yet.")).toBeVisible();
    await bobContext.close();
    expect((await alice.reports.get(id))?.status).toBe("draft");
  });

  test("they refuse a signed-out request and another origin", async ({ page, request }) => {
    const id = randomUUID();
    for (const path of ["/reports", `/reports/${id}`, `/reports/${id}/edit`, "/therapy"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
    }
    expect((await request.get(`/api/reports/${id}/pdf`)).status()).toBe(401);
    expect((await request.post("/api/reports")).status()).toBe(401);
    expect((await request.post(`/api/reports/${id}`, { data: { action: "approve" } })).status()).toBe(401);
    expect((await request.put(`/api/reports/${id}`, { data: { content: {} } })).status()).toBe(401);

    await signUpQuietly(page, newEmail("origin"));
    const foreign = { origin: "https://elsewhere.example" };
    expect((await page.request.post("/api/reports", { headers: foreign })).status()).toBe(403);
    expect(
      (
        await page.request.post(`/api/reports/${id}`, { headers: foreign, data: { action: "approve" } })
      ).status(),
    ).toBe(403);
  });
});

test.describe("email for the account", () => {
  test("a forgotten password is reset through an emailed link, and the link never reaches the page", async ({
    page,
  }) => {
    const email = newEmail("reset");
    await signUpQuietly(page, email);
    await page.context().clearCookies();

    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    // The sign-in page has an Email field too: wait for the new page before typing.
    await expect(page.getByRole("heading", { name: "A new password." })).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send me a link" }).click();
    await expect(page.getByText("If there is a diary for that address, a link")).toBeVisible();

    // The same answer for an address without a diary.
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(newEmail("nobody"));
    await page.getByRole("button", { name: "Send me a link" }).click();
    await expect(page.getByText("If there is a diary for that address, a link")).toBeVisible();

    const reset = outbox(email).find((m) => m.subject.includes("new password"));
    expect(reset).toBeDefined();
    const link = /https?:\/\/\S+/u.exec(reset!.text)![0];
    await page.goto(link);
    await expect(page).toHaveURL(/\/reset-password\?token=/);
    await page.getByLabel("New password").fill("a brand new long password");
    await page.getByRole("button", { name: "Set the new password" }).click();
    await expect(page.getByText("Your password is changed")).toBeVisible();

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("a brand new long password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/home$/);
  });

  test("the address is confirmed through the link sent at sign-up", async ({ page }) => {
    const email = newEmail("verify");
    await signUpQuietly(page, email);
    await page.goto("/settings");
    await expect(page.getByText(`${email} is not confirmed yet.`, { exact: false })).toBeVisible();
    const verification = outbox(email).find((m) => m.subject.includes("Confirm"));
    expect(verification).toBeDefined();
    const link = new URL(/https?:\/\/\S+/u.exec(verification!.text)![0]);
    expect(link.origin).toBe(new URL(page.url()).origin);
    await page.goto(link.toString());
    await page.goto("/settings");
    await expect(page.getByText(`${email} is confirmed.`, { exact: false })).toBeVisible();
  });
});
