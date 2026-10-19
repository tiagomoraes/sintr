import { createDatabase } from "../db/client";
import { createLogger } from "../log";
import { setPersonPlan } from "./subscriptions";

/**
 * `make person-plan EMAIL=... PLAN=...` runs this: PLAN is "personal",
 * "unlimited", or "default" (back to the installation's plan,
 * SINTR_PERSON_PLAN). The email is never logged.
 */
const log = createLogger({ service: "person-plan" });
const url = process.env.DATABASE_URL;
const email = process.env.SINTR_PLAN_EMAIL ?? "";
const plan = (process.env.SINTR_PLAN_NAME ?? "").trim();

if (!url || !email || !/^(personal|unlimited|default)$/.test(plan)) {
  log.error("plan.change_failed", { code: "USAGE" });
  process.stderr.write("usage: make person-plan EMAIL=person@example.com PLAN=personal|unlimited|default\n");
  process.exit(1);
}

const handle = createDatabase(url, { max: 1 });
try {
  const grant = plan === "default" ? null : (plan as "personal" | "unlimited");
  const { userId } = await setPersonPlan(handle.db, { email, plan: grant });
  log.info("plan.changed", { code: grant ?? "default" });
  process.stdout.write(`account ${userId}: ${grant ?? "back to the installation's plan"}\n`);
} catch (error) {
  log.error("plan.change_failed", { error });
  process.exitCode = 1;
} finally {
  await handle.close();
}
