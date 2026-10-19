import type { NoticeView } from "@sintr/core";
import { describe, expect, it } from "vitest";
import {
  MODE_COPY,
  NEVER_SHARED,
  SCOPE_SENTENCE,
  joinPath,
  noticeText,
  patientLabel,
  practiceDetails,
  practiceWho,
  recentNotices,
  seatsLine,
} from "../lib/sharing";

const DASH = /[\u2013\u2014]/u;

function notice(overrides: Partial<NoticeView>): NoticeView {
  return {
    id: "n1",
    kind: "link_active",
    side: "practice",
    linkId: "l1",
    sharedReportId: null,
    readAt: null,
    createdAt: new Date("2026-10-18T12:00:00Z"),
    practice: null,
    personName: null,
    number: null,
    ...overrides,
  };
}

describe("the words of sharing", () => {
  it("say what a link allows in one sentence, and what never travels", () => {
    expect(SCOPE_SENTENCE).toBe("Your therapist can read the reports you approve; nothing else.");
    expect(NEVER_SHARED).toContain("drafts");
    for (const mode of Object.values(MODE_COPY)) expect(mode.sentence).not.toMatch(DASH);
  });

  it("name a practice with what the professional chose to show", () => {
    const card = {
      professionalName: "Dr. Marina Costa",
      practiceName: "Clínica Horizonte",
      registration: "CRP 06/1",
    };
    expect(practiceWho(card)).toBe("Dr. Marina Costa (Clínica Horizonte)");
    expect(practiceDetails(card)).toBe("Clínica Horizonte, CRP 06/1");
    expect(practiceWho({ ...card, practiceName: null })).toBe("Dr. Marina Costa");
    expect(practiceDetails({ practiceName: null, registration: null })).toBeNull();
  });

  it("give a person without a chosen name a neutral label", () => {
    expect(patientLabel({ personName: "Ana", number: 3 })).toBe("Ana");
    expect(patientLabel({ personName: null, number: 3 })).toBe("Patient 3");
    expect(patientLabel({ personName: null, number: null })).toBe("A patient");
  });

  it("count seats plainly", () => {
    expect(seatsLine({ plan: "Self-hosted", seats: null, active: 1, held: 2, free: null })).toBe(
      "1 active patient. Unlimited seats.",
    );
    expect(seatsLine({ plan: "Ten", seats: 10, active: 3, held: 1, free: 6 })).toBe(
      "3 active patients. 4 of 10 seats in use, 1 of them waiting for an acceptance.",
    );
    expect(seatsLine({ plan: "One", seats: 1, active: 0, held: 0, free: 1 })).toBe(
      "0 active patients. 0 of 1 seat in use.",
    );
  });

  it("word each notice for its side, without the person's name once a link ended", () => {
    const practice = { id: "p", professionalName: "Dr. Bruno Lima", practiceName: null, registration: null };
    const lines = [
      noticeText(notice({ side: "person", kind: "link_pending", practice })),
      noticeText(notice({ side: "person", kind: "link_ended", practice })),
      noticeText(notice({ kind: "link_active", personName: "Ana" })),
      noticeText(notice({ kind: "report_shared", number: 4 })),
      noticeText(notice({ kind: "link_declined" })),
      noticeText(notice({ kind: "link_ended", personName: null, number: 4 })),
    ];
    expect(lines).toEqual([
      "Dr. Bruno Lima accepted your invite. Confirm it to start sharing.",
      "Dr. Bruno Lima ended the link. They no longer see your reports.",
      "Ana linked with your practice.",
      "Patient 4 shared a report with you.",
      "A person you accepted chose not to link. Nothing was shared.",
      "A patient ended their link with your practice. Their reports are no longer here.",
    ]);
    for (const line of lines) expect(line).not.toMatch(DASH);
  });

  it("keep two weeks of one side's notices, at most five", () => {
    const now = new Date("2026-10-18T12:00:00Z").getTime();
    const day = 24 * 60 * 60 * 1000;
    const list = [
      notice({ id: "a", createdAt: new Date(now - day) }),
      notice({ id: "b", side: "person", createdAt: new Date(now - day) }),
      notice({ id: "c", kind: "report_shared", createdAt: new Date(now - day) }),
      notice({ id: "d", createdAt: new Date(now - 20 * day) }),
      ...Array.from({ length: 6 }, (_, i) => notice({ id: `e${i}`, createdAt: new Date(now - 2 * day) })),
    ];
    const kept = recentNotices(list, "practice", { skip: "report_shared" }, now);
    expect(kept.map((n) => n.id)).toEqual(["a", "e0", "e1", "e2", "e3"]);
    expect(recentNotices(list, "person", {}, now).map((n) => n.id)).toEqual(["b"]);
  });

  it("open a code at its own path", () => {
    expect(joinPath("ABCD-2345-WXYZ")).toBe("/join/ABCD-2345-WXYZ");
    expect(joinPath("a/b")).toBe("/join/a%2Fb");
  });
});
