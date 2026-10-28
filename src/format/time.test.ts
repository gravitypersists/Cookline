import { describe, expect, it } from "vitest";
import { durationAria, durationText, plannedMinutes, timecode, totalLabel } from "./time";

describe("durations", () => {
  it("marks estimates with ~ and leaves exact times bare", () => {
    expect(durationText({ min: 8, basis: "estimated" })).toBe("~8m");
    expect(durationText({ min: 6, max: 8, basis: "stated", quote: "6 to 8 minutes" })).toBe("~6–8m");
    expect(durationText({ min: 18, basis: "exact", quote: "18 minutes" })).toBe("18m");
    expect(durationText({ min: 90, basis: "stated", quote: "1½ hours" })).toBe("~1h 30m");
    expect(durationText({ min: 60, max: 90, basis: "stated", quote: "1 to 1½ hours" })).toBe("~1h–1h 30m");
  });

  it("reads naturally to screen readers", () => {
    expect(durationAria({ min: 1, basis: "estimated" })).toBe("about 1 minute");
    expect(durationAria({ min: 6, max: 8, basis: "stated" })).toBe("about 6 to 8 minutes");
    expect(durationAria({ min: 18, basis: "exact" })).toBe("exactly 18 minutes");
    expect(durationAria({ min: 60, basis: "stated" })).toBe("about 1 hour");
  });

  it("plans with the midpoint of a range, rounded up", () => {
    expect(plannedMinutes({ min: 8, max: 10, basis: "stated" })).toBe(9);
    expect(plannedMinutes({ min: 6, max: 7, basis: "stated" })).toBe(7);
  });

  it("formats timecodes and totals", () => {
    expect(timecode(4)).toBe("0:04");
    expect(timecode(65)).toBe("1:05");
    expect(totalLabel(47)).toBe("~47 MIN");
    expect(totalLabel(70)).toBe("~1 HR 10 MIN");
  });
});
