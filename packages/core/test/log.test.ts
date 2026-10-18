import { describe, expect, it } from "vitest";
import { REDACTED, createLogger, redact, type LogLevel } from "../src/log";

function capture(level: LogLevel = "debug") {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger({
    level,
    service: "test",
    write: (_level, line) => lines.push(JSON.parse(line) as Record<string, unknown>),
  });
  return { logger, lines };
}

describe("redacting logger", () => {
  it("keeps allowlisted operational fields", () => {
    const { logger, lines } = capture();
    logger.info("entry.created", { userId: "u1", durationMs: 12, count: 3 });
    expect(lines[0]).toMatchObject({
      level: "info",
      event: "entry.created",
      service: "test",
      userId: "u1",
      durationMs: 12,
      count: 3,
    });
  });

  it("redacts every field it does not know, including content", () => {
    const { logger, lines } = capture();
    logger.info("entry.created", {
      situation: "fight with my sister",
      thoughts: ["I always ruin everything"],
      text: "chat message",
      email: "person@example.com",
      password: "hunter22",
    });
    const line = JSON.stringify(lines[0]);
    for (const secret of ["sister", "ruin", "chat message", "person@example.com", "hunter22"]) {
      expect(line).not.toContain(secret);
    }
    expect(lines[0]?.situation).toBe(REDACTED);
  });

  it("redacts objects and arrays even under allowlisted keys", () => {
    expect(redact({ code: { nested: "words" }, userId: ["a", "b"] })).toEqual({
      code: REDACTED,
      userId: REDACTED,
    });
  });

  it("reduces errors to name and code, dropping messages that may echo values", () => {
    const { logger, lines } = capture();
    const error = Object.assign(new Error('duplicate key (email)=(person@example.com) "my thought"'), {
      code: "23505",
    });
    logger.error("db.failed", { error });
    expect(lines[0]).toMatchObject({ errorName: "Error", errorCode: "23505" });
    expect(JSON.stringify(lines[0])).not.toContain("person@example.com");
    expect(JSON.stringify(lines[0])).not.toContain("my thought");
  });

  it("does not let content in through the event name or long strings", () => {
    const { logger, lines } = capture();
    logger.info("I felt ashamed when he said that", {});
    expect(lines[0]?.event).toBe(REDACTED);
    logger.info("ok", { route: "x".repeat(500) });
    expect(String(lines[1]?.route).length).toBeLessThan(220);
  });

  it("respects the level threshold", () => {
    const { logger, lines } = capture("warn");
    logger.info("quiet");
    logger.warn("loud");
    expect(lines.map((l) => l.event)).toEqual(["loud"]);
  });

  it("child loggers carry bindings through the same redaction", () => {
    const { logger, lines } = capture();
    logger.child({ job: "purge", situation: "nope" }).info("job.done");
    expect(lines[0]).toMatchObject({ job: "purge", situation: REDACTED });
  });
});
