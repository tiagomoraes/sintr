import { createDatabase } from "../db/client";
import { createLogger } from "../log";
import { setPracticePlan } from "./plan";

/**
 * `make practice-plan EMAIL=... SEATS=...` runs this: SEATS is a number,
 * "unlimited", or "default" (back to the installation's defaults); PLAN
 * names the plan. The email is never logged.
 */
const log = createLogger({ service: "practice-plan" });
const url = process.env.DATABASE_URL;
const email = process.env.SINTR_PLAN_EMAIL ?? "";
const seats = (process.env.SINTR_PLAN_SEATS ?? "").trim();
const plan = (process.env.SINTR_PLAN_NAME ?? "").trim();

if (!url || !email || !/^(default|unlimited|\d{1,6})$/.test(seats)) {
  log.error("practice.plan_failed", { code: "USAGE" });
  process.stderr.write(
    'usage: make practice-plan EMAIL=professional@example.com SEATS=10|unlimited|default [PLAN="Practice 10"]\n',
  );
  process.exit(1);
}

const handle = createDatabase(url, { max: 1 });
try {
  const grant =
    seats === "default"
      ? null
      : {
          plan: plan || (seats === "unlimited" ? "Unlimited" : `${seats} seats`),
          seats: seats === "unlimited" ? null : Number(seats),
        };
  const { practiceId } = await setPracticePlan(handle.db, { email, grant });
  log.info("practice.plan_changed", { code: grant ? "grant" : "default", count: grant?.seats ?? null });
  process.stdout.write(
    `practice ${practiceId}: ${grant ? `${grant.plan}, ${grant.seats ?? "unlimited"} seats` : "back to the defaults"}\n`,
  );
} catch (error) {
  log.error("practice.plan_failed", { error });
  process.exitCode = 1;
} finally {
  await handle.close();
}
