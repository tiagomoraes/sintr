import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/redirect";

describe("safeNext", () => {
  it("follows same-site paths", () => {
    expect(safeNext("/checkins")).toBe("/checkins");
    expect(safeNext(["/reports", "/x"])).toBe("/reports");
  });

  it("refuses anything that could leave the site", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "javascript:alert(1)",
      "",
      undefined,
    ]) {
      expect(safeNext(value)).toBe("/home");
    }
  });
});
