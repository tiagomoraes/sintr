import { describe, expect, it } from "vitest";
import { hourIn, partOfDay, timeOfDay } from "@/lib/time-of-day";

describe("the room's time of day", () => {
  it("is the hour where the person is", () => {
    const now = new Date("2026-10-19T22:30:00Z");
    expect(hourIn("America/Sao_Paulo", now)).toBe(19);
    expect(hourIn("Asia/Tokyo", now)).toBe(7);
    expect(hourIn("Not/AZone", now)).toBe(22);
  });

  it("names the light of every hour, and the greeting's part of the day", () => {
    const lights = Array.from({ length: 24 }, (_, hour) => timeOfDay(hour));
    expect(lights.slice(0, 5).every((light) => light === "night")).toBe(true);
    expect(timeOfDay(5)).toBe("dawn");
    expect(timeOfDay(9)).toBe("morning");
    expect(timeOfDay(12)).toBe("noon");
    expect(timeOfDay(17)).toBe("golden");
    expect(timeOfDay(19)).toBe("dusk");
    expect(timeOfDay(21)).toBe("evening");
    expect(timeOfDay(23)).toBe("night");
    expect([4, 5, 11, 12, 17, 18, 23].map(partOfDay)).toEqual([
      "evening",
      "morning",
      "morning",
      "afternoon",
      "afternoon",
      "evening",
      "evening",
    ]);
  });
});
