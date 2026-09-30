import { afterEach, describe, expect, it } from "vitest";
import {
  formatDuration,
  formatPace,
  mondayOfISO,
  parseDuration,
  shiftISODate,
  splitTable,
} from "./training";

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

describe("race-day splits for a 4:15:00 target", () => {
  // Pinned to the Race Day tab as it shipped (even / course-adjusted).
  const expected: [string, string, string][] = [
    ["5K", "0:30:13", "0:31:02"],
    ["10K", "1:00:26", "1:00:55"],
    ["15K", "1:30:39", "1:30:48"],
    ["20K", "2:00:52", "2:00:52"],
    ["Half", "2:07:30", "2:07:30"],
    ["25K", "2:31:05", "2:31:15"],
    ["30K", "3:01:18", "3:01:18"],
    ["35K", "3:31:31", "3:32:01"],
    ["40K", "4:01:44", "4:02:14"],
    ["Finish", "4:15:00", "4:15:00"],
  ];

  it("matches the published split table", () => {
    const rows = splitTable(15300).map((r) => [
      r.label,
      formatDuration(r.even),
      formatDuration(r.adjusted),
    ]);
    expect(rows).toEqual(expected);
  });

  it("never runs ahead of even pace before 30K", () => {
    for (const r of splitTable(15300)) {
      if (r.distanceMi < 30 * 0.621371) expect(r.adjusted).toBeGreaterThanOrEqual(r.even);
    }
  });
});
