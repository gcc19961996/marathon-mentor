import { describe, expect, it } from "vitest";
import {
  enduranceFactor,
  predictFromTraining,
  volumeFactor,
  weeklyVolume,
  type AnalysisRun,
  type BestEffortRow,
} from "./paceAnalysis";
import { formatDuration } from "./training";

const run = (date: string, miles: number, id?: number): AnalysisRun =>
  ({
    date,
    type: "",
    distance_mi: miles,
    duration_seconds: Math.round(miles * 560),
    avg_pace_seconds: 560,
    strava_activity_id: id ?? null,
  }) as AnalysisRun;

// The four weeks before Sep 30, 2026 as logged (Sep 22 fixed to 3.5 mi).
const september = [
  run("2026-09-08", 11.72),
  run("2026-09-09", 2.92),
  run("2026-09-10", 2.28),
  run("2026-09-14", 7.79, 14),
  run("2026-09-15", 8.14),
  run("2026-09-17", 4.8),
  run("2026-09-19", 15.94),
  run("2026-09-22", 3.5),
  run("2026-09-29", 17.09, 29),
];
// Best 10K 54:20 (8:45/mi) on Sep 14; the Sep 29 long run's 10K was slower.
const efforts: BestEffortRow[] = [
  { strava_activity_id: 14, name: "10k", distance_m: 10000, seconds: 3260 },
  { strava_activity_id: 29, name: "10k", distance_m: 10000, seconds: 3338 },
];

describe("weekly miles and pace", () => {
  const weeks = weeklyVolume(september, "2026-09-07", "2026-09-30");

  it("has one row per Monday, including weeks with no running", () => {
    expect(weeks.map((w) => w.week)).toEqual([
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ]);
    expect(weeklyVolume([], "2026-09-07", "2026-09-20").map((w) => w.miles)).toEqual([0, 0]);
  });

  it("totals miles, longest run and distance-weighted pace", () => {
    expect(weeks.map((w) => [w.miles, w.longest, w.runs])).toEqual([
      [16.9, 11.7, 3],
      [36.7, 15.9, 4],
      [3.5, 3.5, 1],
      [17.1, 17.1, 1],
    ]);
    expect(weeks.every((w) => w.pace === 560)).toBe(true); // every fixture run is 9:20/mi
  });
});

describe("endurance and volume adjustments", () => {
  it("shrink smoothly between their end points", () => {
    expect(enduranceFactor(12)).toBe(1.04);
    expect(enduranceFactor(14)).toBe(1.04);
    expect(enduranceFactor(17)).toBeCloseTo(1.02, 10);
    expect(enduranceFactor(20)).toBe(1);
    expect(enduranceFactor(26.2)).toBe(1);
    expect(volumeFactor(10)).toBe(1.03);
    expect(volumeFactor(27.5)).toBeCloseTo(1.015, 10);
    expect(volumeFactor(45)).toBe(1);
  });

  it("never penalise a longer run or a bigger week", () => {
    for (let mi = 10; mi < 22; mi += 0.5) {
      expect(enduranceFactor(mi + 0.5)).toBeLessThanOrEqual(enduranceFactor(mi));
    }
    for (let w = 10; w < 45; w += 1) {
      expect(volumeFactor(w + 1)).toBeLessThanOrEqual(volumeFactor(w));
    }
  });
});

describe("predicted finish from training", () => {
  it("credits the Sep 29 long run even though the best 10K is unchanged", () => {
    const before = predictFromTraining(september, efforts, "2026-09-28");
    const after = predictFromTraining(september, efforts, "2026-09-30");
    expect(before?.basis).toMatchObject({
      effort: "Best 10K",
      date: "2026-09-14",
      longestMi: 15.9,
    });
    expect(after?.basis).toMatchObject({ effort: "Best 10K", date: "2026-09-14", longestMi: 17.1 });
    expect(after!.seconds).toBeLessThan(before!.seconds);
  });

  it("matches the value shown on Sep 30, 2026", () => {
    const p = predictFromTraining(september, efforts, "2026-09-30");
    expect(formatDuration(p?.seconds)).toBe("4:21:22");
    expect(p?.basis.weeklyMi).toBe(18.5);
    expect(formatDuration(p?.low)).toBe("4:13:32");
    expect(formatDuration(p?.high)).toBe("4:29:12");
  });

  it("needs a recent 5K or 10K to predict at all", () => {
    expect(predictFromTraining(september, [], "2026-09-30")).toBeNull();
  });
});
