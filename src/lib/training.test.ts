import { afterEach, describe, expect, it } from "vitest";
import { formatDuration, formatPace, mondayOfISO, parseDuration, shiftISODate } from "./training";

describe("time formatting", () => {
  it("parses h:mm:ss, mm:ss and bare minutes", () => {
    expect(parseDuration("4:15:00")).toBe(15300);
    expect(parseDuration("9:44")).toBe(584);
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("9:xx")).toBeNull();
  });

  it("formats durations and paces", () => {
    expect(formatDuration(15300)).toBe("4:15:00");
    expect(formatDuration(null)).toBe("—");
    expect(formatPace(584)).toBe("9:44/mi");
    expect(formatPace(undefined)).toBe("—");
  });
});

describe("shiftISODate / mondayOfISO", () => {
  const originalTz = process.env["TZ"];
  afterEach(() => {
    process.env["TZ"] = originalTz;
  });

  it("adds days across month and year boundaries", () => {
    expect(shiftISODate("2026-09-29", 1)).toBe("2026-09-30");
    expect(shiftISODate("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftISODate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftISODate("2026-04-26", 0, -1)).toBe("2025-04-26");
  });

  it("finds the Monday of a week", () => {
    expect(mondayOfISO("2026-09-29")).toBe("2026-09-28"); // Tue
    expect(mondayOfISO("2026-09-28")).toBe("2026-09-28"); // Mon
    expect(mondayOfISO("2026-11-01")).toBe("2026-10-26"); // Sun, race day
  });

  it("gives the same answer in any time zone", () => {
    for (const tz of ["America/New_York", "Asia/Tokyo", "Pacific/Auckland", "UTC"]) {
      process.env["TZ"] = tz;
      expect(shiftISODate("2026-11-01", 1)).toBe("2026-11-02");
      expect(shiftISODate("2026-09-29", -14)).toBe("2026-09-15");
      expect(mondayOfISO("2026-10-04")).toBe("2026-09-28");
    }
  });
});
