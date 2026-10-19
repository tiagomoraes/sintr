import { describe, expect, it } from "vitest";
import { TRAVEL_MS, inView, placement, sameBox, travelTime } from "@/lib/assistant/flight";
import { isRoom, presenceOn } from "@/lib/assistant/where";

/**
 * F8: the assistant is a resident of the whole diary. The home is its room,
 * every other page of the person's diary carries it in a corner, and the
 * pool of light travels between them as one square moved and scaled about
 * its centre.
 */

describe("where the assistant is", () => {
  it("lives in the home, and in a conversation, which is the home continued", () => {
    for (const path of ["/home", "/talk", "/talk/0b5c3f9e-2f1e-4a7b-9b55-0d2b3a4c5d6e"]) {
      expect(isRoom(path), path).toBe(true);
      expect(presenceOn(path), path).toBe("room");
    }
  });

  it("waits in the corner of every other page of the person's diary", () => {
    for (const path of [
      "/entries",
      "/entries/abc",
      "/checkins/new",
      "/therapy",
      "/reports/abc",
      "/sharing",
      "/connect",
      "/settings",
      "/plan",
    ]) {
      expect(presenceOn(path), path).toBe("corner");
    }
    // A page whose name starts like the home's is not the home.
    expect(presenceOn("/homework")).toBe("corner");
    expect(presenceOn("/talking")).toBe("corner");
  });

  it("stays out of the practice's pages, which carry no help lines either", () => {
    expect(presenceOn("/practice")).toBe("none");
    expect(presenceOn("/practice/details")).toBe("none");
  });
});

describe("the pool's travel", () => {
  const home = { x: 500, y: 140, width: 240, height: 240 };
  const corner = { x: 1340, y: 800, width: 64, height: 64 };

  it("lays the square over a box by its centre, scaled to the box", () => {
    expect(placement(home, 240)).toEqual({ x: 500, y: 140, scale: 1 });
    // A 64px corner from a 240px square: the same centre, a quarter and a bit the size.
    const small = placement(corner, 240);
    expect(small.x + 120).toBe(1372);
    expect(small.y + 120).toBe(832);
    expect(small.scale).toBeCloseTo(64 / 240);
  });

  it("takes longer for a longer way, and stays within calm bounds", () => {
    const diagonal = Math.hypot(1440, 900);
    const near = travelTime(corner, { ...corner, y: 700 }, diagonal);
    const far = travelTime(home, corner, diagonal);
    expect(near).toBeGreaterThanOrEqual(TRAVEL_MS.min);
    expect(far).toBeGreaterThan(near);
    expect(far).toBeLessThanOrEqual(TRAVEL_MS.max);
    expect(travelTime(home, home, diagonal)).toBe(TRAVEL_MS.min);
    expect(travelTime({ ...home, x: -5000 }, corner, diagonal)).toBe(TRAVEL_MS.max);
  });

  it("does not fly in from a place out of sight", () => {
    const viewport = { width: 1440, height: 900 };
    expect(inView(home, viewport)).toBe(true);
    expect(inView({ ...home, y: -400 }, viewport)).toBe(false);
    expect(inView({ ...home, y: 950 }, viewport)).toBe(false);
    expect(inView({ ...home, width: 0, height: 0 }, viewport)).toBe(false);
  });

  it("forgives a pixel of layout rounding at the landing, and nothing more", () => {
    expect(sameBox(home, { ...home, x: home.x + 1.5 })).toBe(true);
    expect(sameBox(home, { ...home, y: home.y + 12 })).toBe(false);
  });
});
