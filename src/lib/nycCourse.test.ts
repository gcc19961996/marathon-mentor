import { describe, expect, it } from "vitest";
import { courseCheckpoints, courseTimeAt, mileSplits, NYC_COURSE } from "./nycCourse";
import { formatDuration } from "./training";

const GOAL = 15300; // 4:15:00

describe("NYC course model", () => {
  it("covers 26 miles plus the final 0.2", () => {
    const miles = mileSplits(GOAL);
    expect(miles).toHaveLength(27);
    expect(miles.at(-1)?.label).toBe("26.2");
    expect(NYC_COURSE[0]?.borough).toBe("Staten Island");
  });

  it("adds up exactly to the goal time for any goal", () => {
    for (const goal of [3 * 3600, GOAL, 5.5 * 3600]) {
      expect(mileSplits(goal).at(-1)?.cumulativeSeconds).toBeCloseTo(goal, 6);
      expect(courseCheckpoints(goal).at(-1)?.course).toBe(goal);
    }
  });

  it("keeps the checkpoints and the mile table in agreement", () => {
    const miles = mileSplits(GOAL);
    expect(courseTimeAt(13, GOAL)).toBeCloseTo(miles[12]!.cumulativeSeconds, 6);
    expect(courseTimeAt(20, GOAL)).toBeCloseTo(miles[19]!.cumulativeSeconds, 6);
  });

  it("budgets extra time for the climbs, not the flats", () => {
    const pace = (mile: number) => mileSplits(GOAL)[mile - 1]!.paceSeconds;
    const flat = pace(5);
    for (const climb of [1, 15, 20, 21, 23, 24]) expect(pace(climb)).toBeGreaterThan(flat);
    expect(pace(16)).toBeLessThan(flat); // off the Queensboro onto First Avenue
    // The plan's race note: miles 1–2 about 10:05 at a 4:15 goal, no banking time.
    expect(pace(1)).toBeGreaterThan(9 * 60 + 50);
    expect(pace(2)).toBeGreaterThan(9 * 60 + 50);
  });

  it("scales every split with the goal time", () => {
    const a = mileSplits(GOAL);
    const b = mileSplits(GOAL * 1.1);
    a.forEach((m, i) => expect(b[i]!.splitSeconds).toBeCloseTo(m.splitSeconds * 1.1, 6));
  });

  it("gives these checkpoints for a 4:15:00 goal", () => {
    expect(courseCheckpoints(GOAL).map((c) => [c.label, formatDuration(c.course)])).toEqual([
      ["5K", "0:30:42"],
      ["10K", "1:00:34"],
      ["15K", "1:30:30"],
      ["20K", "2:00:26"],
      ["Half", "2:07:04"],
      ["25K", "2:30:49"],
      ["30K", "3:00:39"],
      ["35K", "3:30:55"],
      ["40K", "4:01:43"],
      ["Finish", "4:15:00"],
    ]);
  });
});
