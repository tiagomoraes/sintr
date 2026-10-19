import { sql } from "drizzle-orm";
import { createStripe, handlePaymentWebhook, type PaymentProvider, type WebhookResult } from "../billing";
import type { Config } from "../config";
import { createDatabase, type DatabaseHandle } from "../db/client";
import { createEmailTransport, type EmailTransport } from "../email";
import { createLogger, type Logger } from "../log";
import { purgeExpiredAuthRecords, purgeExpiredConversations, purgeStaleInvites } from "../maintenance";
import { memoryWork } from "../memory/work";
import { sendPracticeNotices } from "../practice/notices";
import { reportSchedules, type PersonSchedule } from "../report/schedules";
import { createRepositories, type Repositories } from "../repositories";

/**
 * What every shell gets: configuration, the redacting logger, user-scoped
 * repositories and a few named operations. No shell receives the raw
 * database handle. This part has no auth dependency, so the worker bundle
 * stays free of Better Auth and native password hashing.
 */
export interface BaseRuntime {
  readonly config: Config;
  readonly log: Logger;
  readonly repositories: Repositories;
  /** How email leaves this installation (`available` is false when it is off). */
  readonly email: EmailTransport;
  /** The payment provider, or null when payments are off (plans then come from grants). */
  readonly payments: PaymentProvider | null;
  /** One delivery of the payment provider's webhook: the raw body and its signature header. */
  handlePaymentWebhook(payload: string, signature: string | null): Promise<WebhookResult>;
  /** Everyone with a therapy session to prepare a report for. Clear metadata only. */
  reportSchedules(): Promise<PersonSchedule[]>;
  /** Everyone whose memory is on and has a page to read or a memory to place. Ids only. */
  memoryWork(): Promise<string[]>;
  purgeExpiredAuthRecords(): Promise<{ sessions: number; verificationTokens: number }>;
  /** Conversations past their owner's retention setting (agent_settings). */
  purgeExpiredConversations(): Promise<{ conversations: number }>;
  /** Invites a month past being usable. */
  purgeStaleInvites(now?: Date): Promise<{ invites: number }>;
  /** Email professionals who asked for it that reports arrived (a link and a count). */
  notifyPractices(now?: Date): Promise<{ sent: number }>;
  /** Readiness: true when the database answers. */
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export interface RuntimeOptions {
  service: string;
  poolSize?: number;
  /** Replace the configured transport (tests). */
  email?: EmailTransport;
  /** Replace the payment provider's fetch (tests): nothing reaches the network. */
  paymentsFetch?: typeof fetch;
  /** How the web reads a request's language, for the emails about an account (web only). */
  languageFor?: (headers: Headers, userId: string | null) => Promise<{ code: string; chosen: boolean }>;
}

/** @internal Shared by createBaseRuntime and createRuntime. */
export function openBaseRuntime(
  config: Config,
  options: RuntimeOptions,
): { base: BaseRuntime; database: DatabaseHandle } {
  const log = createLogger({ level: config.logLevel, service: options.service });
  const database = createDatabase(config.databaseUrl, { max: options.poolSize ?? 10 });
  const emailTransport = options.email ?? createEmailTransport(config.email);
  const billing = config.billing;
  const payments =
    billing.kind === "stripe"
      ? createStripe(billing, options.paymentsFetch ? { fetch: options.paymentsFetch } : {})
      : null;
  const base: BaseRuntime = {
    config,
    log,
    repositories: createRepositories(database.db, config.masterKey, {
      practiceDefaults: config.practice,
      personPlan: config.personPlan,
    }),
    email: emailTransport,
    payments,
    async handlePaymentWebhook(payload, signature) {
      if (!payments || billing.kind !== "stripe") return { status: 400, code: "payments_off" };
      return handlePaymentWebhook(
        { db: database.db, provider: payments, prices: billing.prices, log },
        payload,
        signature,
      );
    },
    reportSchedules: () => reportSchedules(database.db),
    memoryWork: () => memoryWork(database.db),
    purgeExpiredAuthRecords: () => purgeExpiredAuthRecords(database.db),
    purgeExpiredConversations: () => purgeExpiredConversations(database.db),
    purgeStaleInvites: (now) => purgeStaleInvites(database.db, now),
    notifyPractices: (now) =>
      sendPracticeNotices({
        db: database.db,
        email: emailTransport,
        origin: config.url.origin,
        log,
        language: config.language,
        ...(now ? { now } : {}),
      }),
    async ping() {
      try {
        await database.db.execute(sql`select 1`);
        return true;
      } catch {
        return false;
      }
    },
    close: () => database.close(),
  };
  return { base, database };
}

export function createBaseRuntime(config: Config, options: RuntimeOptions): BaseRuntime {
  return openBaseRuntime(config, options).base;
}
