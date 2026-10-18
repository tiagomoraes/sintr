import { describe, expect, it } from "vitest";
import { fromLocalInput, toLocalInput } from "@/lib/time";

describe("wall-clock times in the person's zone", () => {
  it("round-trips through a datetime-local value", () => {
    const instant = new Date("2026-10-18T17:30:00Z");
    expect(toLocalInput(instant, "America/Sao_Paulo")).toBe("2026-10-18T14:30");
    expect(fromLocalInput("2026-10-18T14:30", "America/Sao_Paulo")).toEqual(instant);
    expect(toLocalInput(instant, "Asia/Tokyo")).toBe("2026-10-19T02:30");
    expect(fromLocalInput("2026-10-19T02:30", "Asia/Tokyo")).toEqual(instant);
  });

  it("settles the offset across a daylight-saving change", () => {
    // Europe/Lisbon moves from UTC+1 to UTC+0 on 25 October 2026.
    expect(fromLocalInput("2026-10-24T12:00", "Europe/Lisbon")).toEqual(new Date("2026-10-24T11:00:00Z"));
    expect(fromLocalInput("2026-10-26T12:00", "Europe/Lisbon")).toEqual(new Date("2026-10-26T12:00:00Z"));
  });

  it("refuses what is not a time", () => {
    expect(fromLocalInput("", "UTC")).toBeNull();
    expect(fromLocalInput("18/10/2026 14:30", "UTC")).toBeNull();
  });
});
